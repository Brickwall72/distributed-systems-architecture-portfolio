#!/usr/bin/env bash
set -euo pipefail

namespace="${K8S_NAMESPACE:-platform-local}"
db_user="${DB_USER:-neo4j}"
secret_name="topology-db-credentials"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required to create local Kubernetes credentials. Install kubectl and retry." >&2
  exit 127
fi

if ! kubectl config current-context >/dev/null 2>&1; then
  echo "No Kubernetes context is configured. Run pnpm k3d:up and retry." >&2
  exit 1
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  echo "The active Kubernetes API is unavailable. Run pnpm k3d:up and retry." >&2
  exit 1
fi

kubectl create namespace "${namespace}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

if [[ -z "${DB_PASSWORD:-}" ]] && kubectl get secret "${secret_name}" --namespace "${namespace}" >/dev/null 2>&1; then
  echo "Local Kubernetes credentials already exist in secret ${secret_name}/${namespace}."
  exit 0
fi

if [[ -z "${DB_PASSWORD:-}" ]]; then
  db_password="$(openssl rand -hex 24)"
else
  db_password="${DB_PASSWORD}"
fi

kubectl create secret generic "${secret_name}" \
  --namespace "${namespace}" \
  --from-literal="DB_USER=${db_user}" \
  --from-literal="DB_PASSWORD=${db_password}" \
  --from-literal="NEO4J_AUTH=${db_user}/${db_password}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "Local Kubernetes credentials are available in secret topology-db-credentials/${namespace}."
