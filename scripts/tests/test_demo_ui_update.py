import copy
from email.message import Message
import importlib.util
import json
from pathlib import Path
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("demo_ui_update", ROOT / "scripts/k8s-demo-ui-update.py")
update = importlib.util.module_from_spec(spec)
spec.loader.exec_module(update)


def manifest(character="a"):
    return {"source": character * 40,
            "images": {name: f"{update.prefetch.REGISTRY}/{name}@sha256:" + character * 64
                       for name in update.reset.CLIENTS}}


def deployment(name, image):
    return {"apiVersion": "apps/v1", "kind": "Deployment", "metadata": {"name": name, "uid": name},
            "spec": {"replicas": 1, "template": {"spec": {
                "containers": [{"name": "client", "image": image,
                                "env": [{"name": "CONFIG", "value": "unchanged"}]}]}}}}


class DemoUiUpdateTests(unittest.TestCase):
    def test_normalization_permits_only_target_ui_image_change(self):
        original = {"ui": deployment("audit-client", "audit-client:prod"),
                    "backend": deployment("audit-server", "audit-server:prod")}
        candidate = copy.deepcopy(original)
        candidate["ui"]["spec"]["template"]["spec"]["containers"][0]["image"] = manifest()["images"]["audit-client"]
        self.assertEqual(update.normalized_resources(original, "audit-client"),
                         update.normalized_resources(candidate, "audit-client"))
        for key, field in (("ui", "env"), ("backend", "image")):
            changed = copy.deepcopy(candidate)
            changed[key]["spec"]["template"]["spec"]["containers"][0][field] = "unexpected"
            self.assertNotEqual(update.normalized_resources(original, "audit-client"),
                                update.normalized_resources(changed, "audit-client"))
        candidate["extra-job"] = {"kind": "Job", "metadata": {"name": "bootstrap"}}
        self.assertNotEqual(update.normalized_resources(original, "audit-client"),
                            update.normalized_resources(candidate, "audit-client"))

    def test_reset_overlay_preserves_original_inventory_and_other_template_checks(self):
        name = "audit-client"
        saved = deployment(name, "audit-client:prod")
        original = copy.deepcopy(saved)
        live = copy.deepcopy(saved)
        images = manifest()["images"]
        live["spec"]["template"]["spec"]["containers"][0]["image"] = images[name]
        update.reset.verify_deployment(name, saved, live, {name: 1}, images)
        self.assertEqual(saved, original)
        live["spec"]["template"]["spec"]["containers"][0]["env"][0]["value"] = "changed"
        with self.assertRaisesRegex(ValueError, "Deployment changed"):
            update.reset.verify_deployment(name, saved, live, {name: 1}, images)

    def test_interruption_after_approval_keeps_durable_rollback_state_and_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "data.tar.gz"
            archive.write_bytes(b"original-protected-archive")
            before = update.reset.digest(archive)
            revisions = {release: 2 for release in update.RELEASES}
            with patch.object(update, "ROOT", root), patch.object(update, "require_closed_gate"), \
                    patch.object(update, "helm"), patch.object(update.reset, "check_reset",
                                                             side_effect=KeyboardInterrupt):
                self.assertRaises(KeyboardInterrupt, update.execute,
                                  manifest(), revisions, "unused")
            journal = json.loads((root / "ui-update-in-progress").read_text())
            self.assertEqual(journal, {"revisions": revisions, "previous": None})
            self.assertEqual(json.loads((root / "approved-ui-images.json").read_text()), manifest())
            self.assertEqual(update.reset.digest(archive), before)
            self.assertEqual((root / "ui-update-in-progress").stat().st_mode & 0o777, 0o600)

    def test_partial_upgrade_rolls_back_and_retains_marker_after_verified_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            revisions = {release: 2 for release in update.RELEASES}
            failure = subprocess.CalledProcessError(1, ["helm"])
            def run(*args):
                if args[0] == "upgrade" and args[1] == "auth-service":
                    raise failure
            with patch.object(update, "ROOT", root), patch.object(update, "require_closed_gate"), \
                    patch.object(update, "helm", side_effect=run) as helm, \
                    patch.object(update.reset, "check_reset") as check, patch.object(update, "check_http"):
                self.assertRaises(subprocess.CalledProcessError,
                                  update.execute, manifest(), revisions, "unused")
                check.assert_called_once()
            self.assertTrue((root / "ui-update-in-progress").exists())
            self.assertFalse((root / "approved-ui-images.json").exists())
            rollbacks = [call.args for call in helm.call_args_list if call.args[0] == "rollback"]
            self.assertEqual({args[1] for args in rollbacks}, set(revisions))
            self.assertTrue(all(args[2] == "2" and "--no-hooks" in args for args in rollbacks))

    def test_failed_rollback_keeps_marker_and_new_approval_for_explicit_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def run(*args):
                if args[0] == "rollback":
                    raise subprocess.CalledProcessError(1, ["helm", "rollback"])
            with patch.object(update, "ROOT", root), patch.object(update, "require_closed_gate"), \
                    patch.object(update, "helm", side_effect=run), \
                    patch.object(update.reset, "check_reset", side_effect=ValueError("inventory mismatch")):
                self.assertRaises(subprocess.CalledProcessError,
                                  update.execute, manifest(),
                                  {release: 2 for release in update.RELEASES}, "unused")
            self.assertTrue((root / "ui-update-in-progress").exists())
            self.assertEqual(json.loads((root / "approved-ui-images.json").read_text()), manifest())

    def test_only_changed_digest_gets_a_helm_upgrade(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            previous = manifest()
            pending = copy.deepcopy(previous)
            pending["images"]["audit-client"] = manifest("b")["images"]["audit-client"]
            (root / "approved-ui-images.json").write_text(json.dumps(previous))
            with patch.object(update, "ROOT", root), patch.object(update, "require_closed_gate"), \
                    patch.object(update, "private_json", return_value=previous), \
                    patch.object(update, "helm") as helm, patch.object(update.reset, "check_reset"), \
                    patch.object(update, "check_http"):
                update.execute(pending, {release: 2 for release in update.RELEASES}, "unused")
            self.assertEqual(helm.call_count, 1)
            self.assertEqual(helm.call_args.args[:2], ("upgrade", "audit-ledger"))
            self.assertFalse((root / "ui-update-in-progress").exists())

    def test_html_fallback_cannot_pass_federation_readiness(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.headers = Message()
        response.headers["Content-Type"] = "text/html"
        response.read.return_value = b"<"
        opener = MagicMock()
        opener.open.return_value = response
        with patch.object(update, "build_opener", return_value=opener):
            with self.assertRaisesRegex(ValueError, "remoteEntry"):
                update.check_http()

    def test_preflight_rejects_backend_change_before_any_upgrade(self):
        name, role = update.RELEASES["audit-ledger"]
        current = {"ui": deployment(name, "audit-client:prod"),
                   "server": deployment("audit-server", "audit-server:prod")}
        values = {role: {"image": {"repository": "audit-client", "tag": "prod"}}}
        candidate = copy.deepcopy(current)
        candidate["ui"]["spec"]["template"]["spec"]["containers"][0]["image"] = manifest()["images"][name]
        candidate["server"]["spec"]["template"]["spec"]["containers"][0]["env"] = []
        plan = {release: {"sha256": "checksum", "values": values,
                          "resources": update.normalized_resources(current, name)}
                for release in update.RELEASES}
        metadata = SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0)
        pending_manifest = manifest()
        with patch.object(update, "cli", return_value="\n".join(pending_manifest["images"].values())), \
                patch.object(update.prefetch, "verify_directory"), \
                patch.object(update, "private_json", return_value=plan), \
                patch.object(update, "validate_chart"), patch.object(Path, "lstat", return_value=metadata), \
                patch.object(update.reset, "digest", return_value="checksum"), \
                patch.object(update, "release_status", return_value=2), \
                patch.object(update, "helm", return_value=json.dumps(values)) as helm, \
                patch.object(update, "manifest_resources", return_value=current), \
                patch.object(update, "render", return_value=candidate):
            with self.assertRaisesRegex(ValueError, "Non-image manifest changes"):
                update.check_plan(pending_manifest)
        self.assertTrue(all(call.args[0] == "get" for call in helm.call_args_list))


if __name__ == "__main__":
    unittest.main()
