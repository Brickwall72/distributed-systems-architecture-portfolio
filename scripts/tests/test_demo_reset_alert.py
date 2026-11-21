import importlib.util
import json
from pathlib import Path
import stat
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("demo_reset_alert", ROOT / "scripts/k8s-demo-reset-alert.py")
alert = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alert)


class DemoResetAlertTests(unittest.TestCase):
    def test_webhook_rejects_non_discord_or_unsafe_urls(self):
        webhook = MagicMock()
        webhook.lstat.return_value.st_mode = stat.S_IFREG | 0o600
        webhook.lstat.return_value.st_uid = 0
        with patch.object(alert, "WEBHOOK", webhook):
            webhook.read_text.return_value = "https://discord.com/api/webhooks/123/token"
            self.assertEqual(alert.read_webhook(), webhook.read_text.return_value)
            for url in ("http://discord.com/api/webhooks/123/token",
                        "https://discord.com.example.com/api/webhooks/123/token",
                        "https://discord.com/api/webhooks/123/token?leak=1"):
                with self.subTest(url=url), self.assertRaises(ValueError):
                    webhook.read_text.return_value = url
                    alert.read_webhook()

    def test_sends_generic_message_without_mentions(self):
        response = MagicMock()
        response.__enter__.return_value.status = 204
        opener = MagicMock()
        opener.open.return_value = response
        with patch.object(alert, "read_webhook", return_value="https://discord.com/api/webhooks/123/token"), \
             patch.object(alert, "build_opener", return_value=opener):
            alert.send_alert(False)
        request = opener.open.call_args.args[0]
        payload = json.loads(request.data)
        self.assertIn("failed", payload["content"])
        self.assertEqual(payload["allowed_mentions"], {"parse": []})
        self.assertTrue(request.get_header("User-agent").startswith("DiscordBot "))
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 15)

    def test_delivery_errors_do_not_report_webhook_url(self):
        url = "https://discord.com/api/webhooks/123/secret-token"
        for error in (HTTPError(url, 401, "bad", {}, None), URLError("unreachable")):
            opener = MagicMock()
            opener.open.side_effect = error
            with self.subTest(error=type(error).__name__), \
                 patch.object(alert, "read_webhook", return_value=url), \
                 patch.object(alert, "build_opener", return_value=opener), \
                 self.assertRaises(ValueError) as raised:
                alert.send_alert(False)
            self.assertNotIn("secret-token", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
