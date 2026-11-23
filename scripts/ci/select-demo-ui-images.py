#!/usr/bin/env python3
"""Select demo UI images affected between two committed revisions."""

import argparse
import json
from pathlib import Path, PurePosixPath
import re
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
PACKAGES_DIR = "packages/"
BASE_DIRS = (PACKAGES_DIR,)
SERVICES_DIR = "services/"
SMOKE_FILES = frozenset((
    "skaffold.yaml",
    "scripts/ci/ci-demo-ui-browser-smoke.sh", "scripts/ci/demo-ui-browser-smoke.mjs",
    "scripts/k8s-local/k3d-funnel-smoke.sh", "scripts/k8s-local/charts-deps.sh",
    "scripts/dev-env/with-buildkit.sh", "scripts/demo-vm/k8s-demo-secrets.py",
    "scripts/k8s-local/k8s-local-secrets.py",
))
FRONTEND_PACKAGES = ("packages/styles/", "packages/ui/", "packages/vite-config/",
                     "packages/mf-runtime/")
INTEGRATION_FILES = frozenset(("scripts/integration/test-integration.sh", "scripts/integration/integration-compose.yaml"))
SERVICE_INTEGRATION_PACKAGES = frozenset((
    "topology-server", "compliance-server", "audit-server", "esign-server",
    "@shared/messaging", "@shared/filestore",
))
BOOTSTRAP_FILES = frozenset((
    "scripts/tests/test_secret_bootstrap.py", "scripts/k8s-local/k8s-local-secrets.py",
    "scripts/demo-vm/k8s-demo-secrets.py", "scripts/dev-env/copy-env.py", "scripts/dev-env/prepare-local-compose.py",
    "scripts/dev-env/reset-local-compose.py", "scripts/dev-env/generate-auth-keys.sh",
    "scripts/dev-env/generate-nats-credentials.sh", "setup.sh",
))


def matches(path, inputs):
    return any(path.startswith(item) if item.endswith("/") else path == item for item in inputs)


def select_images(paths):
    selected = set()
    for path in runtime_paths(paths):
        if path in BASE_FILES or matches(path, BASE_DIRS):
            return sorted(IMAGES)
        selected.update(image for image, inputs in IMAGES.items() if matches(path, inputs))
    return sorted(selected)


def select_checks(paths, smoke_paths, initial=False):
    images = sorted(IMAGES) if initial else select_images(paths)
    smoke = bool(images) or any(
        path in SMOKE_FILES or path.startswith(("charts/", "infrastructure/minio-setup/"))
        for path in runtime_paths(smoke_paths)
    )
    return images, smoke


def runtime_paths(paths):
    # Markdown in source/public directories may be consumed by the application.
    return [
        path for path in paths
        if not ("src" not in PurePosixPath(path).parts and "public" not in PurePosixPath(path).parts
                and ("docs" in PurePosixPath(path).parts
                     or path.lower().endswith((".md", ".mdx", ".rst"))))
    ]


def workspace_graph():
    root = Path(__file__).resolve().parents[2]
    files = subprocess.run(
        ["git", "ls-files", "-z", "--", "packages/**/package.json",
         "services/**/package.json", "ui-shells/**/package.json"],
        cwd=root, check=True, stdout=subprocess.PIPE,
    ).stdout
    graph = {}
    for filename in files.split(b"\0"):
        if not filename:
            continue
        relative = filename.decode("utf-8")
        manifest = json.loads((root / relative).read_text())
        dependencies = set()
        for field in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
            dependencies.update(manifest.get(field, {}))
        graph[manifest["name"]] = (relative.removesuffix("package.json"), dependencies)
    return graph


def affected_packages(paths, graph):
    affected = {name for name, (directory, _) in graph.items()
                if any(path.startswith(directory) for path in paths)}
    while True:
        dependents = {name for name, (_, dependencies) in graph.items()
                      if dependencies & affected}
        if dependents <= affected:
            return affected
        affected.update(dependents)


def verification_checks(paths, graph):
    paths = runtime_paths(paths)
    affected = affected_packages(paths, graph)
    global_change = any(path in BASE_FILES for path in paths)
    workspace = global_change or any(
        path.startswith((PACKAGES_DIR, SERVICES_DIR, "ui-shells/")) for path in paths
    )
    backend = any(
        (path.startswith(SERVICES_DIR) and ("/server/" in path or "/shared/" in path
                                          or path.endswith("/Dockerfile.server")))
        or (path.startswith(PACKAGES_DIR) and not path.startswith(FRONTEND_PACKAGES))
        for path in paths
    )
    service_integration = global_change or bool(affected & SERVICE_INTEGRATION_PACKAGES) or any(
        path in INTEGRATION_FILES or path == "scripts/integration/test-audit-mongo-authorization.js"
        or path.startswith(("infrastructure/minio-setup/",
                            "charts/compliance-service/charts/database/files/",
                            "charts/audit-ledger/charts/database/files/", "charts/nats/files/"))
        for path in paths
    )
    ui_integration = global_change or "compliance-shell" in affected or any(
        path.startswith("services/core/compliance-service/client/") for path in paths
    )
    contracts = global_change or backend or any(
        path.startswith("services/") and "/client/" in path for path in paths
    )
    automation = global_change or any(
        path.startswith(("scripts/", "charts/", ".github/workflows/"))
        or path in ("setup.sh", "skaffold.yaml")
        or path.endswith(("/compose.yaml", "/.env.example"))
        for path in paths
    )
    return {
        "node": workspace or service_integration or ui_integration or any(
            path in BOOTSTRAP_FILES or path.endswith("/.env.example") for path in paths
        ),
        "workspace": workspace or service_integration or ui_integration,
        "ui_integration": ui_integration,
        "service_integration": service_integration,
        "contracts": contracts,
        "automation": automation,
    }


def changed_paths(base, target):
    for revision in (base, target):
        if not re.fullmatch(r"[0-9a-f]{40}", revision):
            raise ValueError("Expected full lowercase commit SHAs.")
    paths = subprocess.run(
        ["git", "diff", "--name-only", "-z", "--no-renames", base, target, "--"],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    return [path.decode("utf-8", "surrogateescape") for path in paths.split(b"\0") if path]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", help="last successfully published source commit")
    parser.add_argument("target", help="source commit to publish")
    parser.add_argument("--github-output", type=argparse.FileType("a"),
                        help="append CI image and smoke decisions to this output file")
    parser.add_argument("--smoke-base", help="event comparison base for smoke infrastructure changes")
    parser.add_argument("--initial-publication", action="store_true")
    args = parser.parse_args()
    paths = changed_paths(args.base, args.target)
    smoke_paths = changed_paths(args.smoke_base, args.target) if args.smoke_base else paths
    images, smoke = select_checks(paths, smoke_paths, args.initial_publication)
    if args.github_output:
        with args.github_output as output:
            output.write(f"images={str(bool(images)).lower()}\nsmoke={str(smoke).lower()}\n")
            check_paths = smoke_paths + [path for path in paths if select_images([path])]
            for name, enabled in verification_checks(check_paths, workspace_graph()).items():
                if args.initial_publication:
                    enabled = True
                output.write(f"{name}={str(enabled).lower()}\n")
            full_workspace = args.initial_publication or any(path in BASE_FILES for path in check_paths)
            output.write(f"full_workspace={str(full_workspace).lower()}\n")
            output.write(f"base={args.base}\n")
    print(json.dumps(images))


if __name__ == "__main__":
    main()
