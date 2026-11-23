import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/ci/ci-demo-ui-browser-smoke.sh"


class BrowserSmokeCleanupTests(unittest.TestCase):
    def run_smoke(self, existing=False, fail_up=False, fail_down=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts/k8s-local").mkdir(parents=True)
            (root / "scripts/dev-env").mkdir(parents=True)
            (root / "bin").mkdir()
            (root / "runner").mkdir()
            k3d = root / "bin/k3d"
            k3d.write_text("#!/bin/sh\nexit \"$K3D_STATUS\"\n")
            k3d.chmod(0o755)
            kubectl = root / "bin/kubectl"
            kubectl.write_text('#!/bin/sh\necho diagnostics >> "$TEST_LOG"\nexit 1\n')
            kubectl.chmod(0o755)
            helper = root / "scripts/k8s-local/k3d-funnel-smoke.sh"
            helper.write_text(
                '#!/bin/sh\nprintf "%s\\n" "$1" >> "$TEST_LOG"\n'
                'if [ "$1" = up ]; then exit "$UP_STATUS"; fi\n'
                'if [ "$1" = down ]; then exit "$DOWN_STATUS"; fi\n'
            )
            build = root / "scripts/dev-env/with-buildkit.sh"
            build.write_text("#!/bin/sh\nexit 42\n")
            build.chmod(0o755)
            env = {
                **os.environ,
                "PATH": f"{root / 'bin'}:{os.environ['PATH']}",
                "GITHUB_ACTIONS": "true",
                "RUNNER_TEMP": str(root / "runner"),
                "CHROME_BIN": "/unused",
                "TEST_LOG": str(root / "calls"),
                "K3D_STATUS": "0" if existing else "1",
                "UP_STATUS": "42" if fail_up else "0",
                "DOWN_STATUS": "42" if fail_down else "0",
            }
            result = subprocess.run(
                ["bash", str(SCRIPT)], cwd=root, env=env,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            calls = (root / "calls").read_text().splitlines() if (root / "calls").exists() else []
            remaining = list((root / "runner").iterdir())
            return result.returncode, result.stderr, calls, len(remaining)

    def test_existing_cluster_is_never_touched(self):
        status, _, calls, remaining = self.run_smoke(existing=True)
        self.assertNotEqual(status, 0)
        self.assertEqual(calls, [])
        self.assertEqual(remaining, 0)

    def test_failed_creation_is_not_deleted_as_if_owned(self):
        status, _, calls, remaining = self.run_smoke(fail_up=True)
        self.assertNotEqual(status, 0)
        self.assertEqual(calls, ["up"])
        self.assertEqual(remaining, 0)

    def test_failure_after_creation_deletes_cluster_and_private_state(self):
        status, _, calls, remaining = self.run_smoke()
        self.assertNotEqual(status, 0)
        self.assertEqual(calls, ["up", "diagnostics", "diagnostics", "down"])
        self.assertEqual(remaining, 0)

    def test_cleanup_failure_retains_state_and_reports_error(self):
        status, error, calls, remaining = self.run_smoke(fail_down=True)
        self.assertNotEqual(status, 0)
        self.assertEqual(calls, ["up", "diagnostics", "diagnostics", "down"])
        self.assertEqual(remaining, 1)
        self.assertIn("Cluster cleanup failed", error)


if __name__ == "__main__":
    unittest.main()
