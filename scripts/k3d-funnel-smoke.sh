#!/usr/bin/env bash
# File: scripts/k3d-funnel-smoke.sh
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cluster_name="dsap-funnel-smoke"
context="k3d-${cluster_name}"
namespace="platform-funnel-smoke"
image_tag="prod"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/k3d-funnel-smoke.sh up
  bash scripts/k3d-funnel-smoke.sh images
  bash scripts/k3d-funnel-smoke.sh deploy <funnel-hostname>
  bash scripts/k3d-funnel-smoke.sh down

Commands:
  up       Create the disposable loopback-only k3d cluster.
  images   Build with Skaffold only, then import those images into the cluster.
  deploy   Install the public-demo charts directly with Helm; Funnel stays off.
  down     Delete only the dsap-funnel-smoke k3d cluster.
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 127
  fi
}

cluster_exists() {
  k3d cluster get "$cluster_name" >/dev/null 2>&1
}

require_cluster() {
  if ! cluster_exists; then
    echo "Cluster $cluster_name does not exist; run '$0 up' first." >&2
    exit 1
  fi
}

create_cluster() {
  require_command docker
  require_command k3d
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is unavailable." >&2
    exit 1
  fi
  if cluster_exists; then
    echo "Cluster $cluster_name already exists; refusing to alter it." >&2
    exit 1
  fi

  k3d cluster create "$cluster_name" \
    --servers 1 \
    --agents 0 \
    --k3s-arg "--disable=traefik@server:*" \
    --api-port "127.0.0.1:6445" \
    --port "127.0.0.1:8081:80@loadbalancer" \
    --port "127.0.0.1:9000:9000@loadbalancer" \
    --kubeconfig-update-default \
    --kubeconfig-switch-context=false \
    --wait
}

build_and_import_images() {
  require_command docker
  require_command k3d
  require_command skaffold
  require_cluster
  if ! docker image inspect base-image:local >/dev/null 2>&1; then
    echo "base-image:local is missing. Build it without running dev:prepare:" >&2
    echo "  scripts/with-buildkit.sh docker build -f Dockerfile.base -t base-image:local ." >&2
    exit 1
  fi

  cd "$root_dir"
  scripts/with-buildkit.sh skaffold build --tag="$image_tag" --push=false
  k3d image import \
    dsap-minio-setup:"$image_tag" \
    topology-server:"$image_tag" \
    topology-client:"$image_tag" \
    pdf-server:"$image_tag" \
    esign-server:"$image_tag" \
    auth-server:"$image_tag" \
    auth-client:"$image_tag" \
    topology-shell:"$image_tag" \
    compliance-server:"$image_tag" \
    compliance-client:"$image_tag" \
    audit-server:"$image_tag" \
    audit-client:"$image_tag" \
    compliance-shell:"$image_tag" \
    global-shell:"$image_tag" \
    --cluster "$cluster_name"
}

install_chart() {
  local release="$1"
  local chart="$2"
  shift 2
  helm upgrade --install "$release" "$chart" \
    --kube-context "$context" \
    --namespace "$namespace" \
    --wait --wait-for-jobs --timeout 10m \
    "$@"
}

install_chart_without_wait() {
  local release="$1"
  local chart="$2"
  shift 2
  helm upgrade --install "$release" "$chart" \
    --kube-context "$context" \
    --namespace "$namespace" \
    "$@"
}

wait_for_workloads() {
  local kind
  local workload

  kubectl --context "$context" --namespace "$namespace" \
    wait --for=condition=complete jobs --all --timeout=10m
  for kind in statefulsets deployments; do
    while IFS= read -r workload; do
      [[ -z "$workload" ]] || kubectl --context "$context" --namespace "$namespace" \
        rollout status "$workload" --timeout=10m
    done < <(kubectl --context "$context" --namespace "$namespace" get "$kind" -o name)
  done
}

deploy_charts() {
  local funnel_host="${1:-}"
  local secret
  local s3_endpoint

  require_command helm
  require_command kubectl
  require_cluster
  if [[ ! "$funnel_host" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
    echo "Provide a hostname only, such as dev-pc.tail098b41.ts.net." >&2
    exit 2
  fi
  kubectl --context "$context" get namespace "$namespace" >/dev/null
  for secret in \
    topology-db-credentials compliance-db-credentials compliance-db-admin-credentials \
    audit-db-credentials audit-db-admin-credentials minio-credentials \
    minio-compliance-credentials minio-audit-credentials minio-esign-credentials \
    minio-pdf-credentials esign-secrets auth-signing-key auth-public-key \
    nats-broker-credentials nats-compliance-credentials nats-topology-credentials \
    nats-audit-credentials nats-esign-credentials nats-pdf-credentials; do
    kubectl --context "$context" --namespace "$namespace" get secret "$secret" >/dev/null
  done

  cd "$root_dir"
  s3_endpoint="https://${funnel_host}:8443"
  helm repo add traefik https://traefik.github.io/charts --force-update
  helm repo update traefik
  helm upgrade --install traefik traefik/traefik \
    --kube-context "$context" \
    --create-namespace --namespace traefik \
    -f charts/traefik-values.yaml \
    -f charts/traefik-values-funnel-smoke.yaml \
    --wait --timeout 10m

  install_chart traefik-shared charts/traefik-shared
  install_chart network-policies charts/network-policies
  install_chart minio charts/minio \
    --set-string setupImage.tag="$image_tag" \
    --set ingress.enabled=true \
    --set 'ingress.entryPoints[0]=s3' \
    --set-string "ingress.rule=Host(\`$funnel_host\`)" \
    --set-string "corsAllowOrigin=https://$funnel_host"
  install_chart nats charts/nats
  install_chart_without_wait topology-service charts/topology-service
  install_chart_without_wait compliance-service charts/compliance-service \
    --set-string server.minioReadiness.image.tag="$image_tag" \
    --set-string "server.s3PublicEndpoint=$s3_endpoint"
  install_chart_without_wait audit-ledger charts/audit-ledger \
    --set-string server.minioReadiness.image.tag="$image_tag" \
    --set-string "server.s3PublicEndpoint=$s3_endpoint"
  install_chart_without_wait pdf-service charts/pdf-service \
    --set-string server.minioReadiness.image.tag="$image_tag" \
    --set-string "server.s3PublicEndpoint=$s3_endpoint"
  install_chart_without_wait esign-service charts/esign-service \
    --set-string server.minioReadiness.image.tag="$image_tag" \
    --set-string "server.s3PublicEndpoint=$s3_endpoint"
  install_chart_without_wait auth-service charts/auth-service
  install_chart_without_wait topology-shell charts/topology-shell
  install_chart_without_wait compliance-shell charts/compliance-shell
  install_chart_without_wait global-shell charts/global-shell
  wait_for_workloads

  echo "Helm releases installed. Funnel is still off."
  echo "Check readiness: kubectl --context $context -n $namespace get pods"
  echo "Review routes:   kubectl --context $context -n $namespace get ingressroutes.traefik.io"
}

delete_cluster() {
  require_command k3d
  require_cluster
  k3d cluster delete "$cluster_name"
  echo "Deleted $cluster_name. The protected demo Secrets bundle is outside the cluster and was not deleted."
}

main() {
  local command="${1:-}"
  case "$command" in
    up)
      create_cluster
      ;;
    images)
      build_and_import_images
      ;;
    deploy)
      deploy_charts "${2:-}"
      ;;
    down)
      delete_cluster
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
