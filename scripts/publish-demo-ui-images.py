#!/usr/bin/env python3
"""Build selected UI images and write a digest-pinned publication manifest."""

import argparse
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPOSITORY = "https://github.com/Brickwall72/distributed-systems-architecture-portfolio"
CLIENT_DOCKERFILE = "Dockerfile.client"
BUILDS = {
    "topology-client": ("services/core/topology-service", CLIENT_DOCKERFILE),
    "compliance-client": ("services/core/compliance-service", CLIENT_DOCKERFILE),
    "audit-client": ("services/core/audit-ledger", CLIENT_DOCKERFILE),
    "auth-client": ("services/platform/auth-service", CLIENT_DOCKERFILE),
    "global-shell": ("ui-shells/global-shell", "Dockerfile"),
    "topology-shell": ("ui-shells/domain-shells/topology-shell", "Dockerfile"),
    "compliance-shell": ("ui-shells/domain-shells/compliance-shell", "Dockerfile"),
}
SHA = re.compile(r"[0-9a-f]{40}")
DIGEST = re.compile(r"sha256:[0-9a-f]{64}")
REGISTRY = re.compile(r"ghcr\.io/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*")


def command(*args, capture=False):
    return subprocess.run(
        args, cwd=ROOT, check=True, text=True,
        stdout=subprocess.PIPE if capture else None,
    ).stdout


class NoRegistryRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_registry_access(registry, username, token):
    if not REGISTRY.fullmatch(registry):
        raise ValueError("Expected a lowercase GHCR repository prefix.")
    if not username or not token:
        raise ValueError("GITHUB_ACTOR and GHCR_TOKEN are required for registry diagnostics.")
    authorization = base64.b64encode(f"{username}:{token}".encode()).decode()
    opener = build_opener(NoRegistryRedirects())
    for name in sorted(BUILDS):
        scope = f"repository:{registry.removeprefix('ghcr.io/')}/{name}:pull,push"
        request = Request(
            "https://ghcr.io/token?" + urlencode({"service": "ghcr.io", "scope": scope}),
            headers={"Authorization": f"Basic {authorization}"},
        )
        try:
            with opener.open(request, timeout=30) as response:
                result = json.load(response)
        except HTTPError as error:
            raise ValueError(f"GHCR authorization rejected for {name}: HTTP {error.code}.") from None
        if not isinstance(result, dict) or not isinstance(result.get("token"), str) or not result["token"]:
            raise ValueError(f"GHCR returned no authorization token for {name}.")
        print(f"{name}: GHCR accepted the pull,push authorization request.", flush=True)
    print("Authorization checks passed; manifest uploads have not been tested.", flush=True)


def validate_manifest(manifest, registry):
    if not isinstance(manifest, dict) or set(manifest) != {"source", "images"}:
        raise ValueError("Invalid publication manifest.")
    if not isinstance(manifest["source"], str) or not SHA.fullmatch(manifest["source"]):
        raise ValueError("Invalid publication source commit.")
    images = manifest["images"]
    if not isinstance(images, dict) or set(images) != set(BUILDS):
        raise ValueError("Publication manifest must contain exactly the expected UI images.")
    for name, reference in images.items():
        prefix = f"{registry}/{name}@"
        if not isinstance(reference, str) or not reference.startswith(prefix) or not DIGEST.fullmatch(reference[len(prefix):]):
            raise ValueError(f"Invalid digest reference for {name}.")


def publish(source, registry, previous):
    if not SHA.fullmatch(source) or not REGISTRY.fullmatch(registry):
        raise ValueError("Expected a full lowercase Git SHA and lowercase GHCR repository prefix.")
    checked_out = command("git", "rev-parse", "HEAD", capture=True).strip()
    if checked_out != source:
        raise ValueError("The checked-out commit must match the publication source.")
    if command("git", "status", "--porcelain", "--untracked-files=all", capture=True).strip():
        raise ValueError("Publish from a clean checkout so images match their source commit.")
    if previous is None:
        selected = sorted(BUILDS)
        images = {}
    else:
        validate_manifest(previous, registry)
        command("git", "merge-base", "--is-ancestor", previous["source"], source)
        selected = json.loads(command(
            "python3", str(ROOT / "scripts/select-demo-ui-images.py"), previous["source"], source,
            capture=True,
        ))
        if (not isinstance(selected, list) or any(not isinstance(name, str) for name in selected)
                or len(set(selected)) != len(selected) or not set(selected) <= set(BUILDS)):
            raise ValueError("Invalid UI image selection.")
        images = dict(previous["images"])
    if selected:
        command("docker", "build", "-f", "Dockerfile.base", "-t", "base-image:local", ".")
        for name in selected:
            context, dockerfile = BUILDS[name]
            tag = f"{registry}/{name}:{source}"
            command(
                "docker", "build", "--target", "prod",
                "--label", f"org.opencontainers.image.source={SOURCE_REPOSITORY}",
                "--label", f"org.opencontainers.image.revision={source}",
                "-f", f"{context}/{dockerfile}", "-t", tag, context,
            )
            command("docker", "push", tag)
            digest = command("docker", "buildx", "imagetools", "inspect", tag,
                             "--format", "{{.Manifest.Digest}}", capture=True).strip()
            if not DIGEST.fullmatch(digest):
                raise ValueError(f"Registry returned an invalid digest for {name}.")
            images[name] = f"{registry}/{name}@{digest}"
    result = {"source": source, "images": images}
    validate_manifest(result, registry)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="full checked-out source commit SHA")
    parser.add_argument("--registry", required=True, help="lowercase GHCR repository prefix")
    parser.add_argument("--previous", type=Path, help="last successfully published manifest")
    parser.add_argument("--output", type=Path, help="path for the completed manifest")
    parser.add_argument("--check-registry-access", action="store_true",
                        help="check GHCR authorization without building or publishing")
    args = parser.parse_args()
    if args.check_registry_access:
        check_registry_access(args.registry, os.environ.get("GITHUB_ACTOR"), os.environ.get("GHCR_TOKEN"))
        return
    if args.source is None or args.output is None:
        parser.error("--source and --output are required for publication")
    previous = json.loads(args.previous.read_text()) if args.previous else None
    result = publish(args.source, args.registry, previous)
    descriptor, temporary = tempfile.mkstemp(prefix=".demo-ui-", dir=args.output.parent)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(result, stream, indent=2, sort_keys=True)
            stream.write("\n")
        os.replace(temporary, args.output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == "__main__":
    main()
