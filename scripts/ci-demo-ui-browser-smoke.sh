#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" || -z "${RUNNER_TEMP:-}" || -z "${CHROME_BIN:-}" ]]; then
  echo "This script is restricted to GitHub Actions and requires RUNNER_TEMP and CHROME_BIN." >&2
  exit 1
fi
if k3d cluster get dsap-funnel-smoke >/dev/null 2>&1; then
  echo "The smoke cluster already exists; refusing to alter it." >&2
  exit 1
fi

work="$(mktemp -d "$RUNNER_TEMP/dsap-ui-smoke.XXXXXXXX")"
export KUBECONFIG="$work/kubeconfig"
export HELM_CONFIG_HOME="$work/helm/config"
export HELM_CACHE_HOME="$work/helm/cache"
export HELM_DATA_HOME="$work/helm/data"
touch "$KUBECONFIG"
created=false
cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$created" == true && "$status" -ne 0 ]]; then
    echo "Smoke test failed; collecting pod states before cluster cleanup." >&2
    # Only status fields: pod descriptions and application logs can contain credentials.
    kubectl --context k3d-dsap-funnel-smoke --namespace platform-funnel-smoke \
      get pods -o 'custom-columns=NAME:.metadata.name,PHASE:.status.phase,REASON:.status.reason,SCHEDULED:.status.conditions[?(@.type=="PodScheduled")].reason,INIT_WAIT:.status.initContainerStatuses[*].state.waiting.reason,INIT_EXIT:.status.initContainerStatuses[*].state.terminated.reason,WAIT:.status.containerStatuses[*].state.waiting.reason,LAST_EXIT:.status.containerStatuses[*].lastState.terminated.reason,EXIT_CODE:.status.containerStatuses[*].lastState.terminated.exitCode,RESTARTS:.status.containerStatuses[*].restartCount,READY:.status.containerStatuses[*].ready' \
      || echo "Failed to collect pod states." >&2
    kubectl --context k3d-dsap-funnel-smoke get nodes \
      -o 'custom-columns=NAME:.metadata.name,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory,CONDITIONS:.status.conditions[*].type,STATUS:.status.conditions[*].status' \
      || echo "Failed to collect node states." >&2
  fi
  if [[ "$created" == true ]] && ! bash scripts/k3d-funnel-smoke.sh down; then
    echo "Cluster cleanup failed; retaining isolated state at $work." >&2
    exit 1
  fi
  rm -rf -- "$work" || status=1
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! bash scripts/k3d-funnel-smoke.sh up; then
  echo "Cluster creation failed; inspect for partially created k3d resources." >&2
  exit 1
fi
created=true
scripts/with-buildkit.sh docker build -f Dockerfile.base -t base-image:local .
bash scripts/k3d-funnel-smoke.sh images
kubectl --context k3d-dsap-funnel-smoke create namespace platform-funnel-smoke
python3 scripts/k8s-demo-secrets.py \
  --context k3d-dsap-funnel-smoke --namespace platform-funnel-smoke \
  --dir "$work/secrets" --init
sh scripts/charts-deps.sh
bash scripts/k3d-funnel-smoke.sh deploy-loopback
node scripts/demo-ui-browser-smoke.mjs --confirm-disposable-k3d
