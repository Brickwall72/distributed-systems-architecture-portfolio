#!/usr/bin/env python3
"""Stage published UI images on the dedicated demo VM without deploying them."""

import argparse
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path("/var/lib/dsap-demo")
REGISTRY = "ghcr.io/brickwall72"
MANIFEST_URL = (
    "https://raw.githubusercontent.com/Brickwall72/"
    "distributed-systems-architecture-portfolio/demo-ui-published/demo-ui-images.json"
)
MAX_MANIFEST_BYTES = 16384
spec = importlib.util.spec_from_file_location(
    "demo_ui_publisher", Path(__file__).with_name("publish-demo-ui-images.py"),
)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_manifest():
    request = Request(MANIFEST_URL, headers={"Accept": "application/json", "Cache-Control": "no-cache"})
    with build_opener(NoRedirects()).open(request, timeout=30) as response:
        body = response.read(MAX_MANIFEST_BYTES + 1)
    if len(body) > MAX_MANIFEST_BYTES:
        raise ValueError("Published UI manifest exceeds the size limit.")
    manifest = json.loads(body)
    publisher.validate_manifest(manifest, REGISTRY)
    return manifest


def verify_directory(path, private=False):
    metadata = path.lstat()
    forbidden = 0o077 if private else 0o022
    if not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & forbidden:
        raise ValueError(f"Unsafe ownership, permissions, or directory type: {path}")


def verify_pending(path):
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o077:
        raise ValueError("Pending UI manifest must be a root-owned private regular file.")
    publisher.validate_manifest(json.loads(path.read_text()), REGISTRY)


def pull_image(reference):
    subprocess.run(
        ["/usr/local/bin/k3s", "ctr", "--namespace", "k8s.io", "images", "pull",
         "--platform", "linux/amd64", reference],
        check=True,
    )


def stage_manifest(manifest, directory):
    publisher.validate_manifest(manifest, REGISTRY)
    pending = directory / "pending.json"
    verify_pending(pending)
    for name, reference in sorted(manifest["images"].items()):
        print(f"Prefetching {name}.", flush=True)
        pull_image(reference)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".pending-", dir=directory)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(manifest, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, pending)
        descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"All seven UI images staged from commit {manifest['source']}; no deployments changed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate the remote manifest without pulling or writing")
    args = parser.parse_args()
    if args.check:
        manifest = fetch_manifest()
        print(f"Published UI manifest is valid: seven digests from commit {manifest['source']}.")
        return
    if os.geteuid() != 0:
        raise ValueError("Run image prefetch as root.")
    os.umask(0o077)
    verify_directory(ROOT)
    descriptor = os.open(ROOT / ".reset.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError("Another reset or UI prefetch is running; no images were staged.") from error
        if any(path.exists() or path.is_symlink()
               for path in (ROOT / "reset-in-progress", ROOT / "public-reset-pending",
                            ROOT / "ui-update-in-progress")):
            raise ValueError("A reset or public recovery gate is pending; prefetch is blocked.")
        directory = ROOT / "ui-updates"
        directory.mkdir(mode=0o700, exist_ok=True)
        verify_directory(directory, private=True)
        stage_manifest(fetch_manifest(), directory)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Demo UI prefetch failed: {error}", file=sys.stderr)
        sys.exit(1)
