#!/usr/bin/env bash
set -euo pipefail

namespace="${K8S_NAMESPACE:-platform-local}"

# Define default usernames for each database type
topology_db_user="${TOPOLOGY_DB_USER:-neo4j}"
compliance_db_user="${COMPLIANCE_DB_USER:-postgres}"

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

# ---------------------------------------------------------
# 1. TOPOLOGY DB (Neo4j)
# ---------------------------------------------------------
topology_secret_name="topology-db-credentials"

if [[ -z "${TOPOLOGY_DB_PASSWORD:-}" ]] && kubectl get secret "${topology_secret_name}" --namespace "${namespace}" >/dev/null 2>&1; then
  echo "Local Kubernetes credentials already exist in secret ${topology_secret_name}/${namespace}."
else
  topology_db_password="${TOPOLOGY_DB_PASSWORD:-$(openssl rand -hex 24)}"
  
  kubectl create secret generic "${topology_secret_name}" \
    --namespace "${namespace}" \
    --from-literal="DB_USER=${topology_db_user}" \
    --from-literal="DB_PASSWORD=${topology_db_password}" \
    --from-literal="NEO4J_AUTH=${topology_db_user}/${topology_db_password}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    
  echo "Local Kubernetes credentials are available in secret ${topology_secret_name}/${namespace}."
fi

# ---------------------------------------------------------
# 2. COMPLIANCE DB (PostgreSQL)
# ---------------------------------------------------------
compliance_secret_name="compliance-db-credentials"

if [[ -z "${COMPLIANCE_DB_PASSWORD:-}" ]] && kubectl get secret "${compliance_secret_name}" --namespace "${namespace}" >/dev/null 2>&1; then
  echo "Local Kubernetes credentials already exist in secret ${compliance_secret_name}/${namespace}."
else
  compliance_db_password="${COMPLIANCE_DB_PASSWORD:-$(openssl rand -hex 24)}"
  
  kubectl create secret generic "${compliance_secret_name}" \
    --namespace "${namespace}" \
    --from-literal="DB_USER=${compliance_db_user}" \
    --from-literal="DB_PASSWORD=${compliance_db_password}" \
    --from-literal="POSTGRES_USER=${compliance_db_user}" \
    --from-literal="POSTGRES_PASSWORD=${compliance_db_password}" \
    --from-literal="POSTGRES_DB=compliance" \
    --from-literal="DATABASE_URL=postgresql://${compliance_db_user}:${compliance_db_password}@compliance-db:5432/compliance" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    
  echo "Local Kubernetes credentials are available in secret ${compliance_secret_name}/${namespace}."
fi

# ---------------------------------------------------------
# 3. MINIO (S3 Object Storage)
# ---------------------------------------------------------
minio_secret_name="minio-credentials"

if [[ -z "${MINIO_SECRET_KEY:-}" ]] && kubectl get secret "${minio_secret_name}" --namespace "${namespace}" >/dev/null 2>&1; then
  echo "Local Kubernetes credentials already exist in secret ${minio_secret_name}/${namespace}."
else
  # Default to minioadmin if the env vars are missing
  minio_access_key="${MINIO_ACCESS_KEY:-minioadmin}"
  minio_secret_key="${MINIO_SECRET_KEY:-minioadmin}"
  
  kubectl create secret generic "${minio_secret_name}" \
    --namespace "${namespace}" \
    --from-literal="S3_ACCESS_KEY=${minio_access_key}" \
    --from-literal="S3_SECRET_KEY=${minio_secret_key}" \
    --from-literal="MINIO_ROOT_USER=${minio_access_key}" \
    --from-literal="MINIO_ROOT_PASSWORD=${minio_secret_key}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    
  echo "Local Kubernetes credentials are available in secret ${minio_secret_name}/${namespace}."
fi