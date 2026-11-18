# File: infrastructure/minio-setup/files/test_provision.py
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

import provision


class ReadinessMarkersTest(unittest.TestCase):
    def test_creates_and_consumes_each_readiness_marker(self):
        response = MagicMock()
        response.__enter__.return_value = response
        with patch.object(provision, "lock_request", return_value=response) as request:
            provision.provision_ready_markers("http://minio:9000", ("root", "test-password"))

        paths = {f"/dsap/{prefix}.dsap-ready" for _, prefix in provision.USERS.values()}
        self.assertEqual({call.kwargs["path"] for call in request.call_args_list}, paths)
        self.assertEqual(response.read.call_count, len(paths))
        for call in request.call_args_list:
            self.assertEqual(call.args[2:], ("PUT", provision.READY_MARKER))
            self.assertTrue(call.kwargs["conditional"])

    def test_existing_marker_must_match(self):
        for content in (provision.READY_MARKER, b"unexpected marker"):
            with self.subTest(content=content):
                response = MagicMock()
                response.__enter__.return_value = response
                response.read.return_value = content

                def request(_endpoint, _root, method, *_args, **_kwargs):
                    if method == "PUT":
                        raise HTTPError("http://minio:9000", 412, "Already exists", {}, None)
                    return response

                with patch.object(provision, "lock_request", side_effect=request):
                    if content == provision.READY_MARKER:
                        provision.provision_ready_markers("http://minio:9000", ("root", "test-password"))
                    else:
                        with self.assertRaisesRegex(ValueError, "conflicts"):
                            provision.provision_ready_markers("http://minio:9000", ("root", "test-password"))

    def test_other_http_errors_are_not_hidden(self):
        error = HTTPError("http://minio:9000", 403, "Denied", {}, None)
        with patch.object(provision, "lock_request", side_effect=error):
            with self.assertRaises(HTTPError) as raised:
                provision.provision_ready_markers("http://minio:9000", ("root", "test-password"))
        self.assertIs(raised.exception, error)


if __name__ == "__main__":
    unittest.main()
