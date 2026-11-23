#!/usr/bin/env python3
"""Restore the dedicated demo VM's five local-path volumes from its baseline."""

import argparse
import base64
import copy
import fcntl
import hashlib
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
import time
import uuid


NAMESPACE = "platform-demo"
CONTEXT = "default"
K3S_SERVICE = "k3s.service"
ROOT = Path("/var/lib/dsap-demo")
BASELINE = ROOT / "baseline"
STORAGE = Path("/var/lib/rancher/k3s/storage")
MARKER = ROOT / "reset-in-progress"
GUARD = Path("/etc/systemd/system/k3s.service.d/demo-reset-guard.conf")
PUBLIC_GUARD = Path("/etc/systemd/system/tailscaled.service.d/dsap-demo-gate.conf")
PUBLIC_MARKER = ROOT / "public-reset-pending"
DATA = ("topology-db", "compliance-db", "audit-db", "minio", "nats")
SERVERS = ("topology-server", "compliance-server", "audit-server", "auth-server", "esign-server", "pdf-server")
CLIENTS = ("global-shell", "topology-shell", "compliance-shell", "topology-client", "compliance-client",
           "auth-client", "audit-client")
DEPLOYMENTS = set(DATA + SERVERS + CLIENTS)
DATA_ARCHIVE = "data.tar.gz"
BASELINE_FILES = {DATA_ARCHIVE, "replicas.txt", "pv-inventory.json", "pvc-inventory.json",
                  "deployments.json", "credential-bundle.sha256"}
TRAEFIK_SELECTOR = "app.kubernetes.io/name=traefik,app.kubernetes.io/instance=traefik-kube-system"


def command(*args):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout


def kubectl(*args, namespace=NAMESPACE):
    return command("kubectl", "--context", CONTEXT, "--namespace", namespace, *args)


def resources(kind, namespace=NAMESPACE):
    return json.loads(kubectl("get", kind, "-o", "json", namespace=namespace))["items"]


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def verify_baseline_files():
    for path in (BASELINE / "SHA256SUMS", *(BASELINE / name for name in BASELINE_FILES)):
        metadata = path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o077:
            raise ValueError(f"Baseline file is not root-owned and private: {path.name}")


def verify_baseline_manifest():
    entries = {}
    for line in (BASELINE / "SHA256SUMS").read_text().splitlines():
        value, name = line.split("  ", 1)
        if name in entries or name not in BASELINE_FILES or len(value) != 64:
            raise ValueError("Invalid baseline checksum manifest.")
        entries[name] = value
    if set(entries) != BASELINE_FILES:
        raise ValueError("Baseline checksum manifest is incomplete.")
    for name, value in entries.items():
        if digest(BASELINE / name) != value:
            raise ValueError(f"Baseline checksum mismatch: {name}")


def verify_credential_bundle():
    expected_hash = (BASELINE / "credential-bundle.sha256").read_text().split()[0]
    bundle_path = ROOT / "secrets" / "demo-secrets.json"
    if digest(bundle_path) != expected_hash:
        raise ValueError("Credential bundle does not match the baseline.")
    bundle = read_json(bundle_path)
    if bundle["context"] != CONTEXT or bundle["namespace"] != NAMESPACE:
        raise ValueError("Credential bundle belongs to a different context or namespace.")
    return bundle


def verify_live_secrets(bundle):
    for name, expected in bundle["secrets"].items():
        current = json.loads(kubectl("get", "secret", name, "-o", "json"))
        actual = current.get("data", {})
        if set(actual) != set(expected) or any(
                base64.b64decode(actual[key], validate=True) != base64.b64decode(value, validate=True)
                for key, value in expected.items()):
            raise ValueError(f"Secret {name} differs from the baseline credential bundle.")


def verify_baseline(check_live_secrets=True):
    verify_baseline_files()
    verify_baseline_manifest()
    bundle = verify_credential_bundle()
    if check_live_secrets:
        verify_live_secrets(bundle)


def verify_archive_link(member, path):
    target = PurePosixPath(member.linkname)
    if target.is_absolute():
        raise ValueError(f"Unsafe archive link: {member.name}")
    base = path.parent if member.issym() else PurePosixPath()
    parts = []
    for component in (base / target).parts:
        if component == "..":
            if not parts:
                raise ValueError(f"Unsafe archive link: {member.name}")
            parts.pop()
        elif component != ".":
            parts.append(component)
    if not parts or parts[0] != path.parts[0]:
        raise ValueError(f"Archive link escapes its volume: {member.name}")


def verify_archive_member(member, names):
    path = PurePosixPath(member.name)
    if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] not in names:
        raise ValueError(f"Unsafe or unexpected archive path: {member.name}")
    if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
        raise ValueError(f"Unsupported archive entry: {member.name}")
    if member.issym() or member.islnk():
        verify_archive_link(member, path)
    return path.parts[0]


def verify_archive(names):
    roots = set()
    with tarfile.open(BASELINE / DATA_ARCHIVE, "r:gz") as archive:
        for member in archive:
            roots.add(verify_archive_member(member, names))
    if roots != set(names):
        raise ValueError("The baseline archive does not contain exactly the expected volumes.")


def verify_storage_mount(uuid):
    mounted = command("findmnt", "-rn", "-M", str(STORAGE), "-S", f"UUID={uuid}",
                      "-t", "ext4", "-O", "rw", "-o", "TARGET").strip()
    if mounted != str(STORAGE):
        raise ValueError("The expected writable demo data filesystem is not mounted.")
    mounts = command("findmnt", "-rn", "-R", "-M", str(STORAGE), "-o", "TARGET").splitlines()
    if mounts != [str(STORAGE)]:
        raise ValueError("Unexpected nested mounts in the demo data filesystem.")


def verify_claim(name, saved, current, volume):
    if (current["metadata"]["uid"] != saved["metadata"]["uid"]
            or current["spec"]["volumeName"] != volume or current["status"]["phase"] != "Bound"):
        raise ValueError(f"PVC changed or is not bound: {name}")


def verify_volume(name, old_pv, pv, current):
    if (pv["metadata"]["uid"] != old_pv["metadata"]["uid"]
            or pv["spec"].get("claimRef", {}).get("uid") != current["metadata"]["uid"]
            or pv["spec"].get("local") != old_pv["spec"].get("local")):
        raise ValueError(f"Persistent volume changed: {name}")


def verify_volume_path(name, pv, offline):
    path = Path(pv["spec"]["local"]["path"])
    exists = path.exists()
    wrong_device = exists and path.stat().st_dev != STORAGE.stat().st_dev
    unsafe_type = exists and not path.is_dir()
    if (path.parent != STORAGE or path.is_symlink()
            or path.resolve().parent != STORAGE.resolve() or unsafe_type or wrong_device
            or (not offline and not path.is_dir())):
        raise ValueError(f"Unsafe persistent volume path: {name}")
    return path


def verify_storage(uuid, offline=False):
    verify_storage_mount(uuid)
    saved_claims = {item["metadata"]["name"]: item for item in read_json(BASELINE / "pvc-inventory.json")["items"]}
    claims = saved_claims if offline else {item["metadata"]["name"]: item for item in resources("pvc")}
    if set(saved_claims) != set(DATA) or set(claims) != set(DATA):
        raise ValueError("The demo PVC inventory differs from the baseline.")
    saved_volumes = {item["metadata"]["name"]: item for item in read_json(BASELINE / "pv-inventory.json")["items"]}
    volumes = saved_volumes if offline else {item["metadata"]["name"]: item for item in resources("pv")}
    paths = {}
    for name in DATA:
        saved, current = saved_claims[name], claims[name]
        volume = saved["spec"]["volumeName"]
        verify_claim(name, saved, current, volume)
        old_pv, pv = saved_volumes[volume], volumes[volume]
        verify_volume(name, old_pv, pv, current)
        paths[name] = verify_volume_path(name, pv, offline)
    if len(set(paths.values())) != len(DATA):
        raise ValueError("Multiple claims refer to the same directory.")
    verify_archive({path.name for path in paths.values()})
    return paths


def deployment_identity(deployment):
    template = copy.deepcopy(deployment["spec"]["template"])
    annotations = template.get("metadata", {}).get("annotations", {})
    annotations.pop("kubectl.kubernetes.io/restartedAt", None)
    if not annotations:
        template.get("metadata", {}).pop("annotations", None)
    for container in template["spec"].get("containers", []):
        for item in container.get("env", []):
            if item.get("name") in ("S3_PUBLIC_ENDPOINT", "MINIO_API_CORS_ALLOW_ORIGIN") and "value" in item:
                item["value"] = "<endpoint>"
    return template


def read_deployment_counts():
    counts = {}
    for line in (BASELINE / "replicas.txt").read_text().splitlines():
        name, count = line.split()
        if name in counts:
            raise ValueError(f"Duplicate deployment in baseline: {name}")
        counts[name] = int(count)
    return counts


def approved_ui_images():
    path = ROOT / "approved-ui-images.json"
    if not path.exists() and not path.is_symlink():
        return {}
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o077:
        raise ValueError("Approved UI manifest must be root-owned and private.")
    # VM installs place the publisher beside this script; the repository keeps
    # it under scripts/ci/.
    publisher_path = Path(__file__).with_name("publish-demo-ui-images.py")
    if not publisher_path.exists():
        publisher_path = Path(__file__).resolve().parents[1] / "ci" / "publish-demo-ui-images.py"
    spec = importlib.util.spec_from_file_location("ui_publisher", publisher_path)
    publisher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(publisher)
    manifest = read_json(path)
    publisher.validate_manifest(manifest, "ghcr.io/brickwall72")
    return manifest["images"]


def verify_deployment(name, saved, current, counts, images=None):
    if images and name in CLIENTS:
        saved = copy.deepcopy(saved)
        containers = saved["spec"]["template"]["spec"]["containers"]
        if len(containers) != 1 or containers[0]["name"] not in ("client", "shell"):
            raise ValueError(f"Unsupported UI container inventory: {name}")
        containers[0]["image"] = images[name]
    changed = (current["metadata"]["uid"] != saved["metadata"]["uid"]
               or deployment_identity(current) != deployment_identity(saved)
               or current["spec"].get("replicas", 1) != counts[name])
    if changed:
        raise ValueError(f"Deployment changed since baseline: {name}")


def verify_no_extra_workloads():
    kinds = ("statefulsets", "daemonsets", "cronjobs", "horizontalpodautoscalers",
             "replicationcontrollers")
    for kind in kinds:
        if resources(kind):
            raise ValueError(f"Unexpected {kind} in the demo namespace.")
    if any(item.get("status", {}).get("active", 0) for item in resources("jobs")):
        raise ValueError("A demo job is still active.")


def verify_demo_services():
    for service in resources("services"):
        spec = service["spec"]
        if spec.get("type", "ClusterIP") != "ClusterIP" or spec.get("externalIPs"):
            raise ValueError(f"Unexpected exposed demo service: {service['metadata']['name']}")


def verify_workloads():
    saved = {item["metadata"]["name"]: item for item in read_json(BASELINE / "deployments.json")["items"]}
    current = {item["metadata"]["name"]: item for item in resources("deployments")}
    counts = read_deployment_counts()
    if set(saved) != DEPLOYMENTS or set(current) != DEPLOYMENTS or set(counts) != DEPLOYMENTS:
        raise ValueError("Demo deployment inventory differs from the baseline.")
    if any(value != 1 for value in counts.values()):
        raise ValueError("This reset supports the recorded single-replica demo only.")
    images = approved_ui_images()
    for name in DEPLOYMENTS:
        verify_deployment(name, saved[name], current[name], counts, images)
    verify_no_extra_workloads()
    verify_demo_services()


def scale(namespace, names, replicas):
    kubectl("scale", *(f"deployment/{name}" for name in names),
            f"--replicas={replicas}", namespace=namespace)


def wait_no_pods(namespace, selector=None):
    deadline = time.monotonic() + 300
    while True:
        args = ["get", "pods", "-o", "json"]
        if selector:
            args.extend(["-l", selector])
        pods = json.loads(kubectl(*args, namespace=namespace))["items"]
        if not any(pod.get("status", {}).get("phase") not in ("Succeeded", "Failed") for pod in pods):
            return
        if time.monotonic() >= deadline:
            raise ValueError(f"Timed out waiting for pods to stop in {namespace}.")
        time.sleep(3)


def wait_ready(namespace, names):
    for name in names:
        kubectl("rollout", "status", f"deployment/{name}", "--timeout=10m", namespace=namespace)


def verify_gateway_closed():
    deployment = json.loads(kubectl("get", "deployment", "traefik", "-o", "json", namespace="kube-system"))
    if deployment["spec"].get("replicas", 1) != 0:
        raise ValueError("Traefik is not scaled down.")
    slices = json.loads(kubectl("get", "endpointslices", "-l", "kubernetes.io/service-name=traefik",
                                "-o", "json", namespace="kube-system"))["items"]
    if any((endpoint.get("conditions") or {}).get("ready") is not False
           for item in slices for endpoint in (item.get("endpoints") or [])):
        raise ValueError("Traefik still has a ready service endpoint.")


def verify_gateway():
    deployment = json.loads(kubectl("get", "deployment", "traefik", "-o", "json", namespace="kube-system"))
    service = json.loads(kubectl("get", "service", "traefik", "-o", "json", namespace="kube-system"))
    expected = {"app.kubernetes.io/name": "traefik", "app.kubernetes.io/instance": "traefik-kube-system"}
    for selector in (deployment["spec"]["selector"].get("matchLabels", {}),
                     service["spec"].get("selector", {})):
        if any(selector.get(key) != value for key, value in expected.items()):
            raise ValueError("Traefik selectors do not match the dedicated demo ingress.")
    if deployment["spec"].get("replicas", 1) != 1:
        raise ValueError("Expected exactly one Traefik replica before reset.")
    if any(item["spec"]["scaleTargetRef"].get("kind") == "Deployment"
           and item["spec"]["scaleTargetRef"].get("name") == "traefik"
           for item in resources("horizontalpodautoscalers", namespace="kube-system")):
        raise ValueError("Traefik has an autoscaler; it cannot safely gate this reset.")


def wait_deployments_stopped(names):
    deployments = {item["metadata"]["name"]: item for item in resources("deployments")}
    selectors = []
    for name in names:
        selector = deployments[name]["spec"]["selector"]
        if selector.get("matchExpressions") or not selector.get("matchLabels"):
            raise ValueError(f"Unsupported deployment selector: {name}")
        selectors.append(selector["matchLabels"])
    deadline = time.monotonic() + 300
    while True:
        active = []
        for pod in resources("pods"):
            labels = pod["metadata"].get("labels", {})
            if (pod.get("status", {}).get("phase") not in ("Succeeded", "Failed")
                    and any(all(labels.get(key) == value for key, value in selector.items())
                            for selector in selectors)):
                active.append(pod["metadata"]["name"])
        if not active:
            return
        if time.monotonic() >= deadline:
            raise ValueError(f"Timed out waiting for deployments to stop: {', '.join(active)}")
        time.sleep(3)


def write_marker():
    fd = os.open(MARKER, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as file:
        file.write("Reset in progress. Do not start k3s until recovery is complete.\n")
        file.flush()
        os.fsync(file.fileno())
    sync_directory(ROOT)


def sync_directory(path):
    directory = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def verify_guard():
    expected = "[Service]\nExecStartPre=/usr/bin/test ! -e /var/lib/dsap-demo/reset-in-progress\n"
    if GUARD.read_text() != expected or str(GUARD) not in command(
            "systemctl", "show", K3S_SERVICE, "--property=DropInPaths", "--value").split():
        raise ValueError("The k3s reset-in-progress startup guard is not installed and loaded.")


def verify_public_gate():
    if PUBLIC_GUARD.is_symlink():
        raise ValueError("The Tailscale public gate is not a regular file.")
    if not PUBLIC_GUARD.exists():
        return
    metadata = PUBLIC_GUARD.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & 0o022:
        raise ValueError("The Tailscale public gate has unsafe ownership or permissions.")
    if str(PUBLIC_GUARD) not in command(
            "systemctl", "show", "tailscaled.service", "--property=DropInPaths", "--value").split():
        raise ValueError("The Tailscale public gate is not loaded.")
    if not PUBLIC_MARKER.is_file() or PUBLIC_MARKER.is_symlink():
        raise ValueError("Run gated resets through dsap-demo-reset.service.")
    state = command("systemctl", "show", "tailscaled.service", "--property=ActiveState", "--value").strip()
    if state not in ("inactive", "failed"):
        raise ValueError("Tailscale must be stopped before a gated reset.")


def verify_directories():
    for path, forbidden in ((ROOT, 0o022), (BASELINE, 0o077)):
        metadata = path.lstat()
        if not stat.S_ISDIR(metadata.st_mode) or metadata.st_uid != 0 or metadata.st_mode & forbidden:
            raise ValueError(f"Reset directory has unsafe ownership or permissions: {path}")


def interrupted(signum, _frame):
    raise InterruptedError(f"Reset interrupted by signal {signum}.")


def restore_volumes(paths, allow_missing=False):
    stage = Path(tempfile.mkdtemp(prefix=".dsap-reset-", dir=STORAGE))
    incoming, previous = stage / "incoming", stage / "previous"
    incoming.mkdir()
    previous.mkdir()
    print(f"Restore staging directory: {stage}", flush=True)
    command("tar", "--extract", "--gzip", "--numeric-owner", "--same-owner", "--same-permissions",
            "--acls", "--xattrs", "--file", str(BASELINE / DATA_ARCHIVE), "--directory", str(incoming))
    if {path.name for path in incoming.iterdir()} != {path.name for path in paths.values()}:
        raise ValueError("Extracted volume inventory does not match the baseline.")
    for path in paths.values():
        extracted = incoming / path.name
        if extracted.is_symlink() or not extracted.is_dir():
            raise ValueError(f"Extracted volume is not a directory: {path.name}")
    command("sync", "-f", str(incoming))
    for path in paths.values():
        if not allow_missing or path.exists():
            os.rename(path, previous / path.name)
        os.rename(incoming / path.name, path)
    command("sync", "-f", str(STORAGE))
    return stage


def verify_offline():
    state = command("systemctl", "show", K3S_SERVICE, "--property=ActiveState", "--value").strip()
    if state not in ("inactive", "failed"):
        raise ValueError("k3s must be stopped before offline recovery.")
    started = command("systemctl", "show", K3S_SERVICE,
                      "--property=ExecMainStartTimestampMonotonic", "--value").strip()
    if started != "0":
        raise ValueError("Reboot with the reset marker in place before offline recovery.")
    processes = command("ps", "-eo", "comm=").splitlines()
    if any(process.strip() in ("k3s", "k3s-server", "k3s-agent", "containerd", "containerd-shim")
           for process in processes):
        raise ValueError("A Kubernetes container runtime is still running; reboot with the guard in place.")


def parse_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--storage-uuid", required=True, help="UUID of the dedicated demo data filesystem")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="check the baseline and live cluster without changing them")
    mode.add_argument("--execute", action="store_true", help="restore the baseline; the current demo data is replaced")
    mode.add_argument("--recover-offline", action="store_true",
                      help="restore after an interrupted reset, with k3s and containers stopped")
    return parser.parse_args()


def recover_offline(args):
    if not MARKER.is_file() or MARKER.is_symlink():
        raise ValueError("Offline recovery requires the existing reset marker.")
    verify_offline()
    verify_baseline(check_live_secrets=False)
    paths = verify_storage(args.storage_uuid, offline=True)
    stage = restore_volumes(paths, allow_missing=True)
    print(f"Offline baseline restore complete; preserved prior data in {stage}.")
    print("The marker is still present. Do not start k3s until the recovery procedure is completed.")


def check_reset(args):
    verify_baseline()
    verify_workloads()
    verify_storage(args.storage_uuid)
    print("Baseline, credentials, workload inventory and storage checks passed; no data was changed.")


def stop_workloads_after_failure():
    for namespace, names in (("kube-system", ("traefik",)), (NAMESPACE, tuple(DEPLOYMENTS))):
        try:
            scale(namespace, names, 0)
        except (OSError, subprocess.CalledProcessError) as shutdown_error:
            print(f"Failed to stop workloads in {namespace}: {shutdown_error}", file=sys.stderr)


def report_reset_failure(error, gate_attempted):
    if not MARKER.exists():
        try:
            write_marker()
        except OSError as marker_error:
            print(f"CRITICAL: could not retain the reset guard: {marker_error}", file=sys.stderr)
    if gate_attempted:
        stop_workloads_after_failure()
    print(f"Reset failed; marker retained for manual recovery: {error}", file=sys.stderr)


def execute_reset(args):
    verify_public_gate()
    write_marker()
    gate_attempted = False
    try:
        gate_attempted = True
        scale("kube-system", ("traefik",), 0)
        wait_no_pods("kube-system", TRAEFIK_SELECTOR)
        verify_gateway_closed()
        verify_baseline()
        verify_workloads()
        paths = verify_storage(args.storage_uuid)
        scale(NAMESPACE, CLIENTS, 0)
        wait_deployments_stopped(CLIENTS)
        scale(NAMESPACE, SERVERS, 0)
        wait_deployments_stopped(SERVERS)
        scale(NAMESPACE, DATA, 0)
        wait_no_pods(NAMESPACE)
        verify_gateway_closed()
        paths = verify_storage(args.storage_uuid)
        stage = restore_volumes(paths)
        scale(NAMESPACE, DATA, 1)
        wait_ready(NAMESPACE, DATA)
        scale(NAMESPACE, SERVERS, 1)
        wait_ready(NAMESPACE, SERVERS)
        scale(NAMESPACE, CLIENTS, 1)
        wait_ready(NAMESPACE, CLIENTS)
        scale("kube-system", ("traefik",), 1)
        wait_ready("kube-system", ("traefik",))
        shutil.rmtree(stage)
        MARKER.unlink()
        sync_directory(ROOT)
        print("Demo baseline restored; Traefik is available.")
    except (OSError, ValueError, KeyError, tarfile.TarError,
            subprocess.CalledProcessError) as error:
        report_reset_failure(error, gate_attempted)
        raise


def run_with_lock(args):
    with (ROOT / ".reset.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError("Another reset is already running.") from error
        if args.recover_offline:
            recover_offline(args)
            return
        if MARKER.exists():
            raise ValueError("An earlier reset is incomplete; recover it before retrying.")
        if (ROOT / "ui-update-in-progress").exists() or (ROOT / "ui-update-in-progress").is_symlink():
            raise ValueError("An earlier UI update is incomplete; roll it back before resetting.")
        verify_gateway()
        if args.check:
            check_reset(args)
            return
        execute_reset(args)


def main():
    args = parse_arguments()
    if os.geteuid() != 0:
        raise ValueError("Run as root.")
    uuid.UUID(args.storage_uuid)
    verify_directories()
    verify_guard()
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    run_with_lock(args)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, tarfile.TarError,
            subprocess.CalledProcessError) as error:
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        else:
            print(f"Demo reset failed: {error}", file=sys.stderr)
        sys.exit(1)
