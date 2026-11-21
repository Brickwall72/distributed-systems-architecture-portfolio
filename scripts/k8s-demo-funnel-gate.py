#!/usr/bin/env python3
"""Keep Tailscale unavailable until the demo's latest scheduled reset succeeds."""

import argparse
from datetime import datetime, time as datetime_time, timedelta, timezone
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import time
from zoneinfo import ZoneInfo


ROOT = Path("/var/lib/dsap-demo")
RESET_MARKER = ROOT / "reset-in-progress"
PUBLIC_MARKER = ROOT / "public-reset-pending"
LAST_SUCCESS = ROOT / "last-reset-success"
RESTART_REQUEST = Path("/run/dsap-demo-tailscale-restart")
TAILSCALE_SERVICE = "tailscaled.service"
ZONE = ZoneInfo("America/Denver")


def command(*args):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout.strip()


def sync_root():
    descriptor = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def verify_root():
    metadata = ROOT.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o022:
        raise ValueError("Demo state directory must be root-owned and not group- or world-writable.")


def latest_scheduled_reset(now):
    local = now.astimezone(ZONE)
    cutoff = datetime.combine(local.date(), datetime_time(3), tzinfo=ZONE)
    if local < cutoff:
        cutoff -= timedelta(days=1)
    return cutoff.astimezone(timezone.utc)


def is_current(now, synchronized):
    if not synchronized or RESET_MARKER.exists() or PUBLIC_MARKER.exists():
        return False
    try:
        metadata = LAST_SUCCESS.lstat()
    except FileNotFoundError:
        return False
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o077:
        raise ValueError("Last-reset file is not root-owned and private.")
    last_success = datetime.fromtimestamp(metadata.st_mtime, timezone.utc)
    return latest_scheduled_reset(now) <= last_success <= now


def begin_reset():
    try:
        descriptor = os.open(PUBLIC_MARKER, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write("Public access is blocked until the reset succeeds.\n")
            stream.flush()
            os.fsync(stream.fileno())
        sync_root()
    except FileExistsError as error:
        raise ValueError("An earlier public reset gate is still pending; recover before retrying.") from error
    state = command("systemctl", "show", TAILSCALE_SERVICE, "--property=ActiveState", "--value")
    if state in ("active", "activating", "reloading"):
        descriptor = os.open(RESTART_REQUEST, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(descriptor)
        command("systemctl", "stop", TAILSCALE_SERVICE)
    elif state not in ("inactive", "failed", "deactivating"):
        raise ValueError(f"Unexpected Tailscale service state: {state}")


def finish_reset():
    if not PUBLIC_MARKER.is_file() or PUBLIC_MARKER.is_symlink() or RESET_MARKER.exists():
        raise ValueError("Cannot reopen public access without a completed reset and its public gate.")
    if command("timedatectl", "show", "--property=NTPSynchronized", "--value") != "yes":
        raise ValueError("System clock is not synchronized; public access remains blocked.")
    descriptor, temporary_name = tempfile.mkstemp(prefix=".last-reset-", dir=ROOT)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w") as stream:
            stream.write("The demo reset completed successfully.\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, LAST_SUCCESS)
        sync_root()
        PUBLIC_MARKER.unlink()
        sync_root()
    finally:
        if temporary.exists():
            temporary.unlink()
    if RESTART_REQUEST.exists():
        command("systemctl", "start", "--no-block", "tailscaled.service")
        RESTART_REQUEST.unlink()


def wait_for_public_access():
    deadline = time.monotonic() + 900
    while True:
        synchronized = command("timedatectl", "show", "--property=NTPSynchronized", "--value") == "yes"
        if is_current(datetime.now(timezone.utc), synchronized):
            return
        if time.monotonic() >= deadline:
            raise ValueError("Public access is blocked: clock, reset marker, or latest scheduled reset needs attention.")
        time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--before-reset", action="store_true")
    mode.add_argument("--after-reset", action="store_true")
    mode.add_argument("--wait", action="store_true")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise ValueError("Run as root.")
    verify_root()
    if args.before_reset:
        begin_reset()
    elif args.after_reset:
        finish_reset()
    else:
        wait_for_public_access()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        else:
            print(f"Demo public gate failed: {error}", file=sys.stderr)
        sys.exit(1)
