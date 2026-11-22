#!/usr/bin/env python3
"""Select demo UI images affected between two committed revisions."""

import argparse
import json
from pathlib import PurePosixPath
import subprocess


IMAGES = {
    "topology-client": ("services/core/topology-service/client/", "services/core/topology-service/shared/",
                        "services/core/topology-service/Dockerfile.client"),
    "compliance-client": ("services/core/compliance-service/client/", "services/core/compliance-service/shared/",
                          "services/core/compliance-service/Dockerfile.client"),
    "audit-client": ("services/core/audit-ledger/client/", "services/core/audit-ledger/shared/",
                     "services/core/audit-ledger/Dockerfile.client"),
    "auth-client": ("services/platform/auth-service/client/", "services/platform/auth-service/shared/",
                    "services/platform/auth-service/Dockerfile.client"),
    "global-shell": ("ui-shells/global-shell/",),
    "topology-shell": ("ui-shells/domain-shells/topology-shell/",),
    "compliance-shell": ("ui-shells/domain-shells/compliance-shell/",),
}
BASE_FILES = frozenset(("Dockerfile.base", ".dockerignore", "pnpm-lock.yaml",
                        "pnpm-workspace.yaml", "package.json", "tsconfig.json", "turbo.json"))
BASE_DIRS = ("packages/", "services/platform/esign-service/client/")


def matches(path, inputs):
    return any(path.startswith(item) if item.endswith("/") else path == item for item in inputs)


def select_images(paths):
    selected = set()
    for path in paths:
        parts = PurePosixPath(path).parts
        # Source and public assets may include Markdown consumed by the UI.
        if "src" not in parts and "public" not in parts and (
            "docs" in parts or path.lower().endswith((".md", ".mdx", ".rst"))
        ):
            continue
        if path in BASE_FILES or matches(path, BASE_DIRS):
            return sorted(IMAGES)
        selected.update(image for image, inputs in IMAGES.items() if matches(path, inputs))
    return sorted(selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", help="last successfully published source commit")
    parser.add_argument("target", help="source commit to publish")
    args = parser.parse_args()
    paths = subprocess.run(
        ["git", "diff", "--name-only", "-z", "--no-renames", args.base, args.target, "--"],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    print(json.dumps(select_images(path.decode("utf-8", "surrogateescape") for path in paths.split(b"\0") if path)))


if __name__ == "__main__":
    main()
