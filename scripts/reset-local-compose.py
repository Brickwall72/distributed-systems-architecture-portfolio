#!/usr/bin/env python3
"""Preview or explicitly remove this repository's disposable Compose state."""

import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
PROJECTS = ("distributed-systems-architecture-portfolio", "dsap-local")
VOLUMES = {"topology_db_data", "compliance_db_data", "audit_db_data",
           "nats-data", "minio-data", "dbgate-data"}


def docker(*args):
    return subprocess.run(("docker", *args), check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, text=True).stdout


def inspect(kind, identifiers):
    if not identifiers:
        return []
    return json.loads(docker(kind, "inspect", *identifiers))


def inventory(project):
    containers = docker("ps", "-aq", "--filter", f"label=com.docker.compose.project={project}").splitlines()
    volumes = docker("volume", "ls", "-q", "--filter", f"label=com.docker.compose.project={project}").splitlines()
    details = inspect("container", containers)
    if not details and volumes:
        raise ValueError("Cannot verify volume ownership without a project container from this workspace; recover or inspect state manually.")
    for container in details:
        labels = container["Config"].get("Labels") or {}
        if (labels.get("com.docker.compose.project") != project
                or labels.get("com.docker.compose.project.working_dir") != str(ROOT)):
            raise ValueError("A project container is not owned by this workspace; refusing reset.")
    volume_details = inspect("volume", volumes)
    for volume in volume_details:
        labels = volume.get("Labels") or {}
        if (labels.get("com.docker.compose.project") != project
                or labels.get("com.docker.compose.volume") not in VOLUMES):
            raise ValueError(f"Unexpected project volume {volume['Name']}; refusing reset.")
    return details, volume_details


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, choices=PROJECTS)
    parser.add_argument("--execute", action="store_true", help="prompt to delete the previewed state")
    args = parser.parse_args()
    containers, volumes = inventory(args.project)
    print(f"Docker Compose project: {args.project}\nWorkspace: {ROOT}")
    print("Containers to stop and remove:")
    for container in containers:
        print(f"  {container['Name'].lstrip('/')} ({container['Id']})")
    print("Persistent volumes to delete:")
    for volume in volumes:
        print(f"  {volume['Name']}")
    print("This deletes local database, object, event and DBGate state. Kubernetes is not affected.")
    if not args.execute:
        print("Preview only; add --execute to request confirmation.")
        return
    expected = f"reset {args.project}"
    if input(f"Type '{expected}' to continue: ") != expected:
        raise ValueError("Confirmation did not match; no resources were deleted.")
    # Recheck the target after confirmation to reject changed or ambiguous inventory.
    current_containers, current_volumes = inventory(args.project)
    if ({item["Id"] for item in containers} != {item["Id"] for item in current_containers}
            or {item["Name"] for item in volumes} != {item["Name"] for item in current_volumes}):
        raise ValueError("Project inventory changed after preview; no resources were deleted.")
    running = [item["Id"] for item in current_containers if item["State"]["Running"]]
    if running:
        docker("stop", *running)
    if current_containers:
        docker("rm", *(item["Id"] for item in current_containers))
    if current_volumes:
        docker("volume", "rm", *(item["Name"] for item in current_volumes))
    print("Compose state removed. Re-run credential preparation and start the platform.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, EOFError, ValueError, subprocess.CalledProcessError) as error:
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        else:
            print(f"Local Compose reset failed: {error}", file=sys.stderr)
        sys.exit(1)
