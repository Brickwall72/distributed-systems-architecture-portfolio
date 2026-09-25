# File: scripts/k3d-up.sh
#!/usr/bin/env sh
set -eu

cluster_name="platform-cluster"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 127
  fi
}

require_command docker
require_command k3d
require_command kubectl

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is unavailable." >&2
  exit 1
fi

if ! k3d cluster get "$cluster_name" >/dev/null 2>&1; then
  k3d cluster create "$cluster_name" \
    --servers 1 \
    --agents 0 \
    --k3s-arg "--disable=traefik@server:*" \
    --port "8081:80@loadbalancer" \
    --port "8443:443@loadbalancer" \
    --wait

  for image in \
    "dbgate/dbgate:7.2.6" \
    "cgr.dev/chainguard/minio:latest" \
    "cgr.dev/chainguard/minio-client:latest-dev"; do
    docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image"
  done

  k3d image import \
    "dbgate/dbgate:7.2.6" \
    "cgr.dev/chainguard/minio:latest" \
    "cgr.dev/chainguard/minio-client:latest-dev" \
    --cluster "$cluster_name"
fi

kubectl config use-context "k3d-$cluster_name"