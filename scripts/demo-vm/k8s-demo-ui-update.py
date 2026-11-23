#!/usr/bin/env python3
"""Apply UI-only Helm updates while the dedicated demo's public gate is closed."""

import argparse
import copy
import fcntl
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import ProxyHandler, build_opener


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


reset = load("demo_reset", "k8s-demo-reset.py")
prefetch = load("demo_prefetch", "k8s-demo-ui-prefetch.py")
ROOT = reset.ROOT
RELEASES = {
    "audit-ledger": ("audit-client", "client"),
    "auth-service": ("auth-client", "client"),
    "compliance-service": ("compliance-client", "client"),
    "compliance-shell": ("compliance-shell", "shell"),
    "global-shell": ("global-shell", "shell"),
    "topology-service": ("topology-client", "client"),
    "topology-shell": ("topology-shell", "shell"),
}
HTTP_PATHS = ("/", "/audit/client/remoteEntry.js", "/auth/client/remoteEntry.js",
              "/compliance/client/remoteEntry.js", "/compliance-shell/remoteEntry.js",
              "/topology/client/remoteEntry.js", "/topology-shell/remoteEntry.js")


def private_json(path):
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o077:
        raise ValueError(f"Expected a root-owned private regular file: {path.name}")
    return json.loads(path.read_text())


def write_json(path, value):
    descriptor, name = tempfile.mkstemp(prefix=".ui-state-", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(value, stream, sort_keys=True, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        reset.sync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def cli(*args, input=None):
    return subprocess.run(args, input=input, check=True, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def helm(*args):
    return cli("helm", "--kubeconfig", "/etc/rancher/k3s/k3s.yaml",
               "--kube-context", reset.CONTEXT, "--namespace", reset.NAMESPACE, *args)


def manifest_resources(document):
    converted = cli("kubectl", "--context", reset.CONTEXT, "--namespace", reset.NAMESPACE,
                    "create", "--dry-run=client", "--validate=false", "-f", "-", "-o", "json",
                    input=document)
    decoder = json.JSONDecoder()
    items = []
    while converted.strip():
        resource, end = decoder.raw_decode(converted.lstrip())
        items.extend(resource["items"] if resource.get("kind") == "List" else [resource])
        converted = converted.lstrip()[end:]
    if not items:
        raise ValueError("Helm manifest contains no resources.")
    result = {}
    for item in items:
        metadata = item["metadata"]
        key = "|".join((item["apiVersion"], item["kind"], metadata.get("namespace", ""), metadata["name"]))
        if key in result:
            raise ValueError("Duplicate resource in Helm manifest.")
        result[key] = item
    return result


def normalized_resources(resources, name):
    result = copy.deepcopy(resources)
    found = False
    for item in result.values():
        if item["kind"] == "Deployment" and item["metadata"]["name"] == name:
            containers = item["spec"]["template"]["spec"]["containers"]
            if found or len(containers) != 1 or containers[0]["name"] not in ("client", "shell"):
                raise ValueError(f"Unsupported UI deployment in Helm manifest: {name}")
            containers[0]["image"] = "<approved-ui-image>"
            found = True
    if not found:
        raise ValueError(f"Missing UI deployment in Helm manifest: {name}")
    return result


def image_overrides(role, reference):
    repository, digest = reference.split("@", 1)
    return ("--set-string", f"{role}.image.repository={repository}",
            "--set-string", f"{role}.image.digest={digest}")


def normalized_values(values, role):
    result = copy.deepcopy(values)
    result[role]["image"].pop("repository", None)
    result[role]["image"].pop("digest", None)
    return result


def release_status(release):
    status = json.loads(helm("status", release, "-o", "json"))
    if (status["info"]["status"] != "deployed"
            or not isinstance(status["version"], int) or status["version"] < 1):
        raise ValueError(f"Helm release is not deployed: {release}")
    return status["version"]


def validate_chart(path, release):
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode):
        raise ValueError(f"Chart package is not a regular file: {release}")
    with tarfile.open(path, "r:gz") as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if (not name.parts or name.is_absolute() or ".." in name.parts or name.parts[0] != release
                    or not (member.isfile() or member.isdir())):
                raise ValueError(f"Unsafe chart archive: {release}")


def render(release, chart, values, reference=None):
    descriptor, filename = tempfile.mkstemp(prefix=".helm-values-", dir=ROOT / "ui-updates")
    path = Path(filename)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(values, stream)
        args = ("template", release, str(chart), "--is-upgrade", "--no-hooks",
                "--dry-run=server", "--values", str(path))
        if reference:
            args += image_overrides(RELEASES[release][1], reference)
        return manifest_resources(helm(*args))
    finally:
        path.unlink()


def prepare(charts):
    destination = ROOT / "ui-updates" / "helm"
    if destination.exists() or destination.is_symlink():
        raise ValueError("An approved Helm snapshot already exists; do not overwrite it.")
    with tempfile.TemporaryDirectory(prefix=".prepare-", dir=destination.parent) as directory:
        temporary = Path(directory)
        plan = {}
        for release, (name, role) in RELEASES.items():
            source = charts / f"{release}-0.1.0.tgz"
            validate_chart(source, release)
            target = temporary / f"{release}.tgz"
            shutil.copyfile(source, target)
            os.chmod(target, 0o600)
            with target.open("rb") as stream:
                os.fsync(stream.fileno())
            release_status(release)
            values = json.loads(helm("get", "values", release, "--all", "-o", "json"))
            current = normalized_resources(manifest_resources(helm("get", "manifest", release)), name)
            if normalized_resources(render(release, target, values), name) != current:
                raise ValueError(f"Chart snapshot changes resources for {release}; refusing approval.")
            plan[release] = {"sha256": reset.digest(target), "values": values, "resources": current}
        write_json(temporary / "plan.json", plan)
        os.rename(temporary, destination)
        reset.sync_directory(destination.parent)
    print("Approved frozen Helm charts; no workloads or baseline files changed.")


def check_plan(manifest):
    cached = set(cli("/usr/local/bin/k3s", "ctr", "--namespace", "k8s.io",
                     "images", "list", "--quiet").splitlines())
    if not set(manifest["images"].values()).issubset(cached):
        raise ValueError("Some staged UI digests are missing from the k3s image cache; prefetch again.")
    directory = ROOT / "ui-updates" / "helm"
    prefetch.verify_directory(directory, private=True)
    plan = private_json(directory / "plan.json")
    if set(plan) != set(RELEASES):
        raise ValueError("Approved Helm snapshot has an unexpected release inventory.")
    revisions = {}
    for release, (name, role) in RELEASES.items():
        chart = directory / f"{release}.tgz"
        validate_chart(chart, release)
        metadata = chart.lstat()
        if metadata.st_uid != 0 or metadata.st_mode & 0o077 or reset.digest(chart) != plan[release]["sha256"]:
            raise ValueError(f"Approved chart checksum or permissions changed: {release}")
        revisions[release] = release_status(release)
        live_values = json.loads(helm("get", "values", release, "--all", "-o", "json"))
        if normalized_values(live_values, role) != normalized_values(plan[release]["values"], role):
            raise ValueError(f"Helm configuration drifted since approval: {release}")
        current = normalized_resources(manifest_resources(helm("get", "manifest", release)), name)
        candidate = render(release, chart, live_values, manifest["images"][name])
        if current != plan[release]["resources"] or normalized_resources(candidate, name) != current:
            raise ValueError(f"Non-image manifest changes detected for {release}.")
        deployment = next(item for item in candidate.values()
                          if item["kind"] == "Deployment" and item["metadata"]["name"] == name)
        if deployment["spec"]["template"]["spec"]["containers"][0]["image"] != manifest["images"][name]:
            raise ValueError(f"Chart did not render the required digest: {name}")
    return revisions


def check_http():
    opener = build_opener(ProxyHandler({}), prefetch.NoRedirects())
    for path in HTTP_PATHS:
        with opener.open("http://127.0.0.1" + path, timeout=15) as response:
            content_type = response.headers.get_content_type()
            expected = ("text/html",) if path == "/" else ("application/javascript", "text/javascript")
            if response.status != 200 or content_type not in expected or not response.read(1):
                raise ValueError(f"UI HTTP readiness failed for {path}.")


def require_closed_gate():
    if not reset.PUBLIC_GUARD.is_file() or reset.PUBLIC_GUARD.is_symlink():
        raise ValueError("The installed Tailscale gate is required for UI updates.")
    reset.verify_public_gate()
    if reset.MARKER.exists() or reset.MARKER.is_symlink():
        raise ValueError("The data reset is incomplete; UI updates are blocked.")


def rollback(journal, storage_uuid):
    require_closed_gate()
    revisions = journal["revisions"]
    if (not revisions or not set(revisions).issubset(RELEASES)
            or any(type(value) is not int or value < 1 for value in revisions.values())):
        raise ValueError("Invalid rollback revision inventory.")
    if journal["previous"] is not None:
        prefetch.publisher.validate_manifest(journal["previous"], prefetch.REGISTRY)
    for release in RELEASES:
        if release not in revisions:
            continue
        print(f"Rolling back Helm release {release}.", flush=True)
        helm("rollback", release, str(journal["revisions"][release]),
             "--wait", "--no-hooks", "--timeout", "3m")
    approval = ROOT / "approved-ui-images.json"
    if journal["previous"] is None:
        approval.unlink(missing_ok=True)
        reset.sync_directory(ROOT)
    else:
        write_json(approval, journal["previous"])
    reset.check_reset(argparse.Namespace(storage_uuid=storage_uuid))
    check_http()


def execute(manifest, revisions, storage_uuid):
    require_closed_gate()
    approval = ROOT / "approved-ui-images.json"
    previous = private_json(approval) if approval.exists() else None
    changed = {release: revision for release, revision in revisions.items()
               if previous is None or previous["images"][RELEASES[release][0]] != manifest["images"][RELEASES[release][0]]}
    journal = {"revisions": changed, "previous": previous}
    marker = ROOT / "ui-update-in-progress"
    write_json(marker, journal)
    try:
        for release, (name, role) in RELEASES.items():
            if release not in changed:
                continue
            print(f"Upgrading UI image in Helm release {release}.", flush=True)
            helm("upgrade", release, str(ROOT / "ui-updates" / "helm" / f"{release}.tgz"),
                 "--reuse-values", "--no-hooks", "--wait", "--timeout", "3m",
                 *image_overrides(role, manifest["images"][name]))
        write_json(approval, manifest)
        reset.check_reset(argparse.Namespace(storage_uuid=storage_uuid))
        check_http()
        marker.unlink()
        reset.sync_directory(ROOT)
        print(f"UI update verified at commit {manifest['source']}; the public gate is still closed.")
    except (OSError, ValueError, KeyError, tarfile.TarError, subprocess.CalledProcessError):
        print("UI update failed; attempting Helm rollback. Public access remains blocked.", file=sys.stderr)
        rollback(journal, storage_uuid)
        print("Rollback verified. Update marker retained; explicitly recover before reopening access.", file=sys.stderr)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--storage-uuid", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare", type=Path, metavar="CHART_DIRECTORY")
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--execute-if-staged", action="store_true")
    mode.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise ValueError("Run as root.")
    os.umask(0o077)
    os.environ["PATH"] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    os.environ["KUBECONFIG"] = "/etc/rancher/k3s/k3s.yaml"
    reset.uuid.UUID(args.storage_uuid)
    reset.verify_directories()
    reset.verify_guard()
    prefetch.verify_directory(ROOT / "ui-updates", private=True)
    signal.signal(signal.SIGTERM, reset.interrupted)
    signal.signal(signal.SIGINT, reset.interrupted)
    descriptor = os.open(ROOT / ".reset.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError("Another reset or UI operation is running.") from error
        marker = ROOT / "ui-update-in-progress"
        if args.rollback:
            rollback(private_json(marker), args.storage_uuid)
            marker.unlink()
            reset.sync_directory(ROOT)
            print("Rollback verified; public access remains blocked until explicitly reopened.")
            return
        if marker.exists() or marker.is_symlink():
            raise ValueError("An earlier UI update is incomplete; use --rollback with the gate closed.")
        if reset.MARKER.exists() or reset.MARKER.is_symlink():
            raise ValueError("An earlier data reset is incomplete; recover it first.")
        if args.execute_if_staged:
            require_closed_gate()
        reset.verify_gateway()
        reset.check_reset(args)
        if args.prepare:
            prepare(args.prepare)
            return
        pending = ROOT / "ui-updates" / "pending.json"
        if args.execute_if_staged and not pending.exists() and not pending.is_symlink():
            print("No staged UI update; existing deployments retained.")
            return
        manifest = private_json(pending)
        prefetch.publisher.validate_manifest(manifest, prefetch.REGISTRY)
        if reset.approved_ui_images() == manifest["images"]:
            print("Staged UI digests are already deployed; no Helm changes needed.")
            return
        revisions = check_plan(manifest)
        if args.check:
            print("UI update preflight passed; no deployments or baseline files changed.")
        else:
            execute(manifest, revisions, args.storage_uuid)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, tarfile.TarError, subprocess.CalledProcessError) as error:
        detail = f"command exited {error.returncode}" if isinstance(error, subprocess.CalledProcessError) else str(error)
        print(f"Demo UI update failed: {detail}", file=sys.stderr)
        sys.exit(1)
