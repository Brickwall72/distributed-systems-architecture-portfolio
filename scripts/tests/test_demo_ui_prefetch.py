import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("demo_ui_prefetch", ROOT / "scripts/k8s-demo-ui-prefetch.py")
prefetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prefetch)


def manifest(source="a"):
    return {
        "source": source * 40,
        "images": {name: f"{prefetch.REGISTRY}/{name}@sha256:" + "1" * 64
                   for name in prefetch.publisher.BUILDS},
    }


class DemoUiPrefetchTests(unittest.TestCase):
    def test_all_images_are_pulled_before_pending_manifest_is_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pending = root / "pending.json"
            old = manifest()
            pending.write_text(json.dumps(old))
            observations = []
            def pull(reference):
                observations.append((reference, json.loads(pending.read_text())))
            with patch.object(prefetch, "verify_pending"), patch.object(prefetch, "pull_image", side_effect=pull):
                prefetch.stage_manifest(manifest("b"), root)
            self.assertEqual(len(observations), 7)
            self.assertTrue(all(saved == old for _, saved in observations))
            self.assertEqual(json.loads(pending.read_text()), manifest("b"))
            self.assertEqual(pending.stat().st_mode & 0o777, 0o600)
            self.assertEqual([path.name for path in root.iterdir()], ["pending.json"])

    def test_failed_pull_preserves_previous_pending_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pending = root / "pending.json"
            pending.write_text(json.dumps(manifest()))
            with patch.object(prefetch, "verify_pending"), patch.object(
                prefetch, "pull_image",
                side_effect=[None, subprocess.CalledProcessError(1, ["k3s"])],
            ):
                next_manifest = manifest("b")
                with self.assertRaises(subprocess.CalledProcessError):
                    prefetch.stage_manifest(next_manifest, root)
            self.assertEqual(json.loads(pending.read_text()), manifest())
            self.assertEqual([path.name for path in root.iterdir()], ["pending.json"])

    def test_rejects_foreign_registry_before_pulling(self):
        invalid = manifest()
        invalid["images"]["global-shell"] = "ghcr.io/other/global-shell@sha256:" + "1" * 64
        with tempfile.TemporaryDirectory() as directory, patch.object(prefetch, "pull_image") as pull:
            with self.assertRaises(ValueError):
                prefetch.stage_manifest(invalid, Path(directory))
            pull.assert_not_called()

    def test_image_pull_uses_k3s_runtime_and_exact_digest(self):
        reference = manifest()["images"]["global-shell"]
        with patch.object(prefetch.subprocess, "run") as run:
            prefetch.pull_image(reference)
        run.assert_called_once_with(
            ["/usr/local/bin/k3s", "ctr", "--namespace", "k8s.io", "images", "pull",
             "--platform", "linux/amd64", reference], check=True,
        )

    def test_reset_gate_blocks_prefetch_without_network_or_pulls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "public-reset-pending").touch()
            with patch.object(prefetch, "ROOT", root), patch.object(prefetch, "verify_directory"), \
                    patch.object(prefetch.os, "geteuid", return_value=0), \
                    patch.object(prefetch.os, "umask"), patch("sys.argv", ["prefetch"]), \
                    patch.object(prefetch, "fetch_manifest") as fetch:
                with self.assertRaisesRegex(ValueError, "gate is pending"):
                    prefetch.main()
                fetch.assert_not_called()
                self.assertFalse((root / "ui-updates").exists())


if __name__ == "__main__":
    unittest.main()
