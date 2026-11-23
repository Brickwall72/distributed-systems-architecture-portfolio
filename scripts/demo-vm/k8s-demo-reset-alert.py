#!/usr/bin/env python3
"""Send a generic demo reset alert to a private Discord webhook."""

import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


WEBHOOK = Path("/var/lib/dsap-demo/secrets/reset-alert-webhook")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_webhook():
    metadata = WEBHOOK.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o077:
        raise ValueError("Webhook file must be a root-owned private regular file.")
    url = WEBHOOK.read_text().strip()
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != "discord.com" or parsed.query or parsed.fragment
            or not re.fullmatch(r"/api/webhooks/\d+/[A-Za-z0-9_-]+/?", parsed.path)):
        raise ValueError("Webhook file does not contain a valid Discord webhook URL.")
    return url


def send_alert(test):
    message = ("Demo reset alert test." if test else
               "Demo reset or Tailscale access failed. Check the VM's systemd journal and keep public access disabled until resolved.")
    payload = json.dumps({"content": message, "allowed_mentions": {"parse": []}}).encode()
    request = Request(read_webhook(), data=payload, headers={
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/Brickwall72/distributed-systems-architecture-portfolio, 1.0)",
    }, method="POST")
    try:
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            if response.status not in (200, 204):
                raise ValueError(f"Discord returned unexpected HTTP status {response.status}.")
    except HTTPError as error:
        content_type = error.headers.get_content_type() if error.headers else ""
        if content_type == "text/html":
            response_type = "HTML"
        elif content_type == "application/json":
            response_type = "JSON"
        else:
            response_type = "other"
        raise ValueError(f"Discord rejected the alert (HTTP {error.code}; {response_type} response).") from None
    except URLError as error:
        raise ValueError(f"Discord alert network error ({type(error.reason).__name__}).") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--test", action="store_true", help="send a test notification")
    mode.add_argument("--failure", action="store_true", help="send a reset failure notification")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise ValueError("Run as root.")
    send_alert(args.test)
    print("Discord alert delivered.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Discord alert failed: {error}", file=sys.stderr)
        sys.exit(1)
