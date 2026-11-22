import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("demo_reset", ROOT / "scripts/k8s-demo-reset.py")
reset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reset)


class DemoResetTests(unittest.TestCase):
    def make_archive(self, directory, entries):
        baseline = Path(directory) / "baseline"
        baseline.mkdir()
        with tarfile.open(baseline / "data.tar.gz", "w:gz") as archive:
            for name, kind, value in entries:
                item = tarfile.TarInfo(name)
                item.type = kind
                item.uid = os.getuid()
                item.gid = os.getgid()
                if kind == tarfile.REGTYPE:
                    item.size = len(value)
                    archive.addfile(item, io.BytesIO(value))
                else:
                    item.linkname = value
                    archive.addfile(item)
        return baseline

    def test_archive_rejects_traversal_and_cross_volume_links(self):
        cases = [
            [("volume/../../other", tarfile.REGTYPE, b"x")],
            [("volume/link", tarfile.SYMTYPE, "../../outside")],
            [("volume/link", tarfile.LNKTYPE, "other/file")],
            [("unexpected/file", tarfile.REGTYPE, b"x")],
        ]
        for entries in cases:
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as directory:
                baseline = self.make_archive(directory, entries)
                with patch.object(reset, "BASELINE", baseline), self.assertRaises(ValueError):
                    reset.verify_archive({"volume"})

    def test_restore_stages_old_volume_before_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            storage = root / "storage"
            storage.mkdir()
            volume = storage / "volume"
            volume.mkdir()
            (volume / "file").write_text("current")
            baseline = self.make_archive(root, [("volume/file", tarfile.REGTYPE, b"baseline")])
            with patch.object(reset, "BASELINE", baseline), patch.object(reset, "STORAGE", storage):
                reset.verify_archive({"volume"})
                stage = reset.restore_volumes({"claim": volume})
            self.assertEqual((volume / "file").read_text(), "baseline")
            self.assertEqual((stage / "previous" / "volume" / "file").read_text(), "current")

    def test_extract_failure_does_not_replace_current_volume(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            storage = root / "storage"
            storage.mkdir()
            volume = storage / "volume"
            volume.mkdir()
            (volume / "file").write_text("current")
            baseline = self.make_archive(root, [("volume/file", tarfile.REGTYPE, b"baseline")])
            with patch.object(reset, "BASELINE", baseline), patch.object(reset, "STORAGE", storage), \
                 patch.object(reset, "command", side_effect=subprocess.CalledProcessError(1, ["tar"])):
                with self.assertRaises(subprocess.CalledProcessError):
                    reset.restore_volumes({"claim": volume})
            self.assertEqual((volume / "file").read_text(), "current")

    def test_interrupted_swap_retains_previous_volume(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            storage = root / "storage"
            storage.mkdir()
            volume = storage / "volume"
            volume.mkdir()
            (volume / "file").write_text("current")
            baseline = self.make_archive(root, [("volume/file", tarfile.REGTYPE, b"baseline")])
            rename = os.rename
            calls = 0

            def interrupted(source, destination):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("interrupted swap")
                rename(source, destination)

            with patch.object(reset, "BASELINE", baseline), patch.object(reset, "STORAGE", storage), \
                 patch.object(reset.os, "rename", side_effect=interrupted):
                with self.assertRaisesRegex(OSError, "interrupted swap"):
                    reset.restore_volumes({"claim": volume})
            stage = next(storage.glob(".dsap-reset-*"))
            self.assertEqual((stage / "previous/volume/file").read_text(), "current")
            self.assertEqual((stage / "incoming/volume/file").read_text(), "baseline")

    def test_offline_recovery_repairs_partial_swap_and_retains_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            storage = root / "storage"
            storage.mkdir()
            first = storage / "first"
            second = storage / "second"
            second.mkdir()
            (second / "file").write_text("current")
            baseline = self.make_archive(root, [
                ("first/file", tarfile.REGTYPE, b"baseline first"),
                ("second/file", tarfile.REGTYPE, b"baseline second"),
            ])
            marker = root / "reset-in-progress"
            marker.touch()
            arguments = ["reset", "--storage-uuid", "b062b31f-e866-4c96-a782-6a7579850fdd",
                         "--recover-offline"]
            with patch.object(reset, "ROOT", root), patch.object(reset, "STORAGE", storage), \
                 patch.object(reset, "BASELINE", baseline), patch.object(reset, "MARKER", marker), \
                 patch.object(reset, "verify_guard"), patch.object(reset, "verify_directories"), \
                 patch.object(reset, "verify_offline"), patch.object(reset, "verify_baseline"), \
                 patch.object(reset, "verify_storage", return_value={"a": first, "b": second}), \
                 patch.object(reset.os, "geteuid", return_value=0), patch("sys.argv", arguments):
                reset.main()
            self.assertTrue(marker.exists())
            self.assertEqual((first / "file").read_text(), "baseline first")
            self.assertEqual((second / "file").read_text(), "baseline second")
            stage = next(storage.glob(".dsap-reset-*"))
            self.assertEqual((stage / "previous/second/file").read_text(), "current")

    def test_offline_recovery_rejects_running_cluster_or_container_runtime(self):
        for responses in (["active"], ["failed", "1"], ["failed", "0", "containerd-shim\n"]):
            with self.subTest(responses=responses), \
                 patch.object(reset, "command", side_effect=responses), \
                 self.assertRaises(ValueError):
                reset.verify_offline()

    def test_offline_storage_accepts_missing_volume_but_not_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            storage = root / "storage"
            storage.mkdir()
            baseline = self.make_archive(root, [("volume/file", tarfile.REGTYPE, b"baseline")])
            claim = {"metadata": {"name": "db", "uid": "claim-uid"},
                     "spec": {"volumeName": "pv"}, "status": {"phase": "Bound"}}
            pv = {"metadata": {"name": "pv", "uid": "pv-uid"},
                  "spec": {"claimRef": {"uid": "claim-uid"}, "local": {"path": str(storage / "volume")}}}
            (baseline / "pvc-inventory.json").write_text(json.dumps({"items": [claim]}))
            (baseline / "pv-inventory.json").write_text(json.dumps({"items": [pv]}))
            def findmnt(*args):
                return f"{storage}\n"
            with patch.object(reset, "BASELINE", baseline), patch.object(reset, "STORAGE", storage), \
                 patch.object(reset, "DATA", ("db",)), patch.object(reset, "command", side_effect=findmnt):
                self.assertEqual(reset.verify_storage("uuid", offline=True), {"db": storage / "volume"})
                (storage / "volume").symlink_to(root)
                with self.assertRaisesRegex(ValueError, "Unsafe persistent volume path"):
                    reset.verify_storage("uuid", offline=True)

    def test_endpoint_updates_do_not_hide_other_workload_changes(self):
        deployment = {"spec": {"template": {
            "metadata": {"annotations": {"checksum/config": "one"}},
            "spec": {"containers": [{"name": "server", "image": "server:v1",
                                     "env": [{"name": "S3_PUBLIC_ENDPOINT", "value": "http://lan"}]}]},
        }}}
        changed = copy.deepcopy(deployment)
        changed["spec"]["template"]["spec"]["containers"][0]["env"][0]["value"] = "https://demo"
        changed["spec"]["template"]["metadata"]["annotations"]["kubectl.kubernetes.io/restartedAt"] = "now"
        self.assertEqual(reset.deployment_identity(deployment), reset.deployment_identity(changed))
        changed["spec"]["template"]["metadata"]["annotations"]["checksum/config"] = "two"
        self.assertNotEqual(reset.deployment_identity(deployment), reset.deployment_identity(changed))

    def test_gateway_with_empty_endpoint_slice_is_closed(self):
        deployment = json.dumps({"spec": {"replicas": 0}})
        for endpoints in (None, [], [{"conditions": {"ready": False}}]):
            with self.subTest(endpoints=endpoints), patch.object(
                    reset, "kubectl", side_effect=[deployment, json.dumps({"items": [{"endpoints": endpoints}]})]):
                reset.verify_gateway_closed()
        for conditions in (None, {}, {"ready": True}):
            with self.subTest(conditions=conditions), patch.object(
                    reset, "kubectl", side_effect=[
                        deployment, json.dumps({"items": [{"endpoints": [{"conditions": conditions}]}]})
                    ]), self.assertRaisesRegex(ValueError, "ready service endpoint"):
                reset.verify_gateway_closed()

    def test_installed_public_gate_rejects_direct_or_running_tailscale_reset(self):
        guard = MagicMock()
        guard.__str__.return_value = "/etc/systemd/system/tailscaled.service.d/dsap-demo-gate.conf"
        guard.is_symlink.return_value = False
        guard.exists.return_value = True
        guard.lstat.return_value.st_mode = stat.S_IFREG | 0o644
        guard.lstat.return_value.st_uid = 0
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "pending"
            with patch.object(reset, "PUBLIC_GUARD", guard), patch.object(reset, "PUBLIC_MARKER", marker), \
                 patch.object(reset, "command", return_value=str(guard)):
                with self.assertRaisesRegex(ValueError, "through dsap-demo-reset.service"):
                    reset.verify_public_gate()
            marker.touch()
            with patch.object(reset, "PUBLIC_GUARD", guard), patch.object(reset, "PUBLIC_MARKER", marker), \
                 patch.object(reset, "command", side_effect=[str(guard), "active"]):
                with self.assertRaisesRegex(ValueError, "Tailscale must be stopped"):
                    reset.verify_public_gate()
            with patch.object(reset, "PUBLIC_GUARD", guard), patch.object(reset, "PUBLIC_MARKER", marker), \
                 patch.object(reset, "command", side_effect=[str(guard), "inactive"]):
                reset.verify_public_gate()

    def test_failed_restore_keeps_ingress_and_workloads_stopped(self):
        calls = []

        def scale(namespace, names, replicas):
            calls.append((namespace, set(names), replicas))

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "reset-in-progress"
            arguments = ["reset", "--storage-uuid", "b062b31f-e866-4c96-a782-6a7579850fdd", "--execute"]
            with patch.object(reset, "ROOT", root), patch.object(reset, "MARKER", marker), \
                 patch.object(reset, "verify_guard"), patch.object(reset, "verify_directories"), \
                 patch.object(reset, "verify_gateway"), patch.object(reset, "verify_baseline"), \
                 patch.object(reset, "verify_workloads"), patch.object(reset, "verify_storage", return_value={}), \
                 patch.object(reset, "scale", side_effect=scale), patch.object(reset, "wait_no_pods"), \
                 patch.object(reset, "verify_gateway_closed"), \
                 patch.object(reset, "wait_deployments_stopped"), \
                 patch.object(reset, "restore_volumes", side_effect=ValueError("test failure")), \
                 patch.object(reset.os, "geteuid", return_value=0), patch("sys.argv", arguments):
                with self.assertRaisesRegex(ValueError, "test failure"):
                    reset.main()
            self.assertTrue(marker.exists())
            self.assertEqual(calls[0], ("kube-system", {"traefik"}, 0))
            self.assertEqual(calls[-2], ("kube-system", {"traefik"}, 0))
            self.assertEqual(calls[-1], (reset.NAMESPACE, reset.DEPLOYMENTS, 0))
            self.assertFalse(any(replicas == 1 for _, _, replicas in calls))

    def test_check_does_not_gate_or_modify_volumes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "reset-in-progress"
            arguments = ["reset", "--storage-uuid", "b062b31f-e866-4c96-a782-6a7579850fdd", "--check"]
            with patch.object(reset, "ROOT", root), patch.object(reset, "MARKER", marker), \
                 patch.object(reset, "verify_guard"), patch.object(reset, "verify_directories"), \
                 patch.object(reset, "verify_gateway"), patch.object(reset, "verify_baseline"), \
                 patch.object(reset, "verify_workloads"), patch.object(reset, "verify_storage"), \
                 patch.object(reset, "scale") as scale, patch.object(reset, "restore_volumes") as restore, \
                 patch.object(reset.os, "geteuid", return_value=0), patch("sys.argv", arguments):
                reset.main()
            self.assertFalse(marker.exists())
            scale.assert_not_called()
            restore.assert_not_called()

    def test_existing_marker_blocks_even_a_check(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "reset-in-progress"
            marker.touch()
            arguments = ["reset", "--storage-uuid", "b062b31f-e866-4c96-a782-6a7579850fdd", "--check"]
            with patch.object(reset, "ROOT", root), patch.object(reset, "MARKER", marker), \
                 patch.object(reset, "verify_guard"), patch.object(reset, "verify_directories"), \
                 patch.object(reset, "verify_gateway") as gateway, \
                 patch.object(reset.os, "geteuid", return_value=0), patch("sys.argv", arguments):
                with self.assertRaisesRegex(ValueError, "earlier reset is incomplete"):
                    reset.main()
            gateway.assert_not_called()
            self.assertTrue(marker.exists())

    def test_interrupted_ui_update_blocks_reset_before_cluster_access(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "ui-update-in-progress"
            marker.touch()
            arguments = ["reset", "--storage-uuid", "b062b31f-e866-4c96-a782-6a7579850fdd", "--check"]
            with patch.object(reset, "ROOT", root), patch.object(reset, "MARKER", root / "reset"), \
                    patch.object(reset, "verify_guard"), patch.object(reset, "verify_directories"), \
                    patch.object(reset, "verify_gateway") as gateway, \
                    patch.object(reset.os, "geteuid", return_value=0), patch("sys.argv", arguments):
                with self.assertRaisesRegex(ValueError, "UI update is incomplete"):
                    reset.main()
            gateway.assert_not_called()
            self.assertTrue(marker.exists())

    def test_gateway_reopens_only_after_workloads_are_ready(self):
        events = []
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "reset-in-progress"
            stage = root / "stage"
            stage.mkdir()
            arguments = ["reset", "--storage-uuid", "b062b31f-e866-4c96-a782-6a7579850fdd", "--execute"]
            with patch.object(reset, "ROOT", root), patch.object(reset, "MARKER", marker), \
                 patch.object(reset, "verify_guard"), patch.object(reset, "verify_directories"), \
                 patch.object(reset, "verify_gateway"), patch.object(reset, "verify_baseline"), \
                 patch.object(reset, "verify_workloads"), patch.object(reset, "verify_storage", return_value={}), \
                 patch.object(reset, "scale", side_effect=lambda n, names, count: events.append(("scale", n, set(names), count))), \
                 patch.object(reset, "wait_no_pods"), patch.object(reset, "verify_gateway_closed"), \
                 patch.object(reset, "wait_deployments_stopped", side_effect=lambda names: events.append(("stopped", set(names)))), \
                 patch.object(reset, "wait_ready", side_effect=lambda n, names: events.append(("ready", n, set(names)))), \
                 patch.object(reset, "restore_volumes", return_value=stage), \
                 patch.object(reset.os, "geteuid", return_value=0), patch("sys.argv", arguments):
                reset.main()
            self.assertFalse(marker.exists())
            self.assertFalse(stage.exists())
            self.assertLess(events.index(("stopped", set(reset.CLIENTS))),
                            events.index(("scale", reset.NAMESPACE, set(reset.SERVERS), 0)))
            self.assertLess(events.index(("stopped", set(reset.SERVERS))),
                            events.index(("scale", reset.NAMESPACE, set(reset.DATA), 0)))
            self.assertLess(events.index(("ready", reset.NAMESPACE, set(reset.CLIENTS))),
                            events.index(("scale", "kube-system", {"traefik"}, 1)))


if __name__ == "__main__":
    unittest.main()
