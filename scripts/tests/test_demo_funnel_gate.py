from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("demo_funnel_gate", ROOT / "scripts/k8s-demo-funnel-gate.py")
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class DemoFunnelGateTests(unittest.TestCase):
    def test_latest_boundary_across_spring_dst_transition(self):
        before = datetime.fromisoformat("2027-03-14T08:30:00+00:00")
        after = datetime.fromisoformat("2027-03-14T09:00:00+00:00")
        self.assertEqual(gate.latest_scheduled_reset(before), datetime.fromisoformat("2027-03-13T10:00:00+00:00"))
        self.assertEqual(gate.latest_scheduled_reset(after), after)

    def test_gate_requires_synchronized_clock_current_reset_and_no_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            now = datetime.fromisoformat("2026-11-21T15:00:00+00:00")
            metadata = SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0, st_mtime=now.timestamp())
            last = MagicMock()
            last.lstat.return_value = metadata
            with patch.object(gate, "LAST_SUCCESS", last), patch.object(gate, "RESET_MARKER", root / "reset"), \
                 patch.object(gate, "PUBLIC_MARKER", root / "pending"):
                self.assertTrue(gate.is_current(now, True))
                self.assertFalse(gate.is_current(now, False))
                metadata.st_mtime = (now - timedelta(days=1)).timestamp()
                self.assertFalse(gate.is_current(now, True))
                metadata.st_mtime = now.timestamp()
                (root / "pending").touch()
                self.assertFalse(gate.is_current(now, True))

    def test_reset_stops_and_restarts_previously_running_tailscale(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(gate, "ROOT", root), patch.object(gate, "RESET_MARKER", root / "reset"), \
                 patch.object(gate, "PUBLIC_MARKER", root / "pending"), \
                 patch.object(gate, "LAST_SUCCESS", root / "success"), \
                 patch.object(gate, "RESTART_REQUEST", root / "restart"), \
                 patch.object(gate, "command", side_effect=["active", "", "yes", ""]) as command:
                gate.begin_reset()
                self.assertTrue((root / "pending").exists())
                self.assertTrue((root / "restart").exists())
                gate.finish_reset()
                self.assertFalse((root / "pending").exists())
                self.assertFalse((root / "restart").exists())
                self.assertTrue((root / "success").is_file())
                self.assertEqual(command.call_args.args, ("systemctl", "start", "--no-block", "tailscaled.service"))

    def test_failed_or_incomplete_reset_cannot_reopen_access(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "pending").touch()
            (root / "reset").touch()
            with patch.object(gate, "ROOT", root), patch.object(gate, "RESET_MARKER", root / "reset"), \
                 patch.object(gate, "PUBLIC_MARKER", root / "pending"), \
                 patch.object(gate, "command") as command:
                with self.assertRaisesRegex(ValueError, "completed reset"):
                    gate.finish_reset()
                self.assertTrue((root / "pending").exists())
                command.assert_not_called()

    def test_reset_does_not_start_manually_stopped_tailscale(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(gate, "ROOT", root), patch.object(gate, "RESET_MARKER", root / "reset"), \
                 patch.object(gate, "PUBLIC_MARKER", root / "pending"), \
                 patch.object(gate, "LAST_SUCCESS", root / "success"), \
                 patch.object(gate, "RESTART_REQUEST", root / "restart"), \
                 patch.object(gate, "command", side_effect=["inactive", "yes"]) as command:
                gate.begin_reset()
                gate.finish_reset()
                self.assertEqual(command.call_count, 2)

    def test_interrupted_ui_update_blocks_reopening_and_startup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "pending").touch()
            (root / "ui-update-in-progress").touch()
            with patch.object(gate, "ROOT", root), patch.object(gate, "RESET_MARKER", root / "reset"), \
                    patch.object(gate, "PUBLIC_MARKER", root / "pending"), \
                    patch.object(gate, "command") as command:
                with self.assertRaisesRegex(ValueError, "completed reset"):
                    gate.finish_reset()
                command.assert_not_called()
                self.assertTrue((root / "pending").exists())
                (root / "pending").unlink()
                now = datetime.now(timezone.utc)
                last = MagicMock()
                last.lstat.return_value = SimpleNamespace(
                    st_mode=stat.S_IFREG | 0o600, st_uid=0, st_mtime=now.timestamp())
                with patch.object(gate, "LAST_SUCCESS", last):
                    self.assertFalse(gate.is_current(now, True))


if __name__ == "__main__":
    unittest.main()
