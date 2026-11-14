# File: scripts/k8s-local-secrets.sh
#!/usr/bin/env bash
set -euo pipefail

namespace="${K8S_NAMESPACE:-platform-local}"

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

bash scripts/generate-nats-credentials.sh
ensure_nats_secret() {
  local name="$1"
  local env_file="$2"
  local existing
  existing=$(kubectl get secret "$name" --namespace "$namespace" --ignore-not-found -o name)
  if [[ -z "$existing" ]]; then
    kubectl create secret generic "$name" --namespace "$namespace" --from-env-file="$env_file" >/dev/null
  else
    local key value actual
    while IFS='=' read -r key value; do
      actual=$(kubectl get secret "$name" --namespace "$namespace" -o "jsonpath={.data.$key}" | base64 --decode)
      if [[ "$actual" != "$value" ]]; then
        echo "Existing Kubernetes secret $name differs from $env_file; it was not changed." >&2
        exit 1
      fi
    done < "$env_file"
  fi
  echo "Kubernetes secret $name/$namespace is available."
}

ensure_nats_secret nats-broker-credentials .auth-keys/nats/broker.env
for user in compliance topology audit esign pdf; do
  ensure_nats_secret "nats-$user-credentials" ".auth-keys/nats/$user.env"
done

# Helper function to safely read variables from a service .env file
load_env_val() {
  local env_file="$1"
  local var_name="$2"
  local default_val="$3"
  
  if [[ -f "$env_file" ]]; then
    local val
    val=$(grep -E "^${var_name}=" "$env_file" | tail -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [[ -n "${val:-}" ]]; then
      echo "$val"
      return 0
    fi
  fi
  echo "$default_val"
}

# ---------------------------------------------------------
# 1. TOPOLOGY DB (Neo4j)
# ---------------------------------------------------------
topology_secret_name="topology-db-credentials"
topology_env_file="services/core/topology-service/.env"
topology_db_user=$(load_env_val "$topology_env_file" "DB_USER" "neo4j")
topology_db_password=$(load_env_val "$topology_env_file" "DB_PASSWORD" "$(openssl rand -hex 24)")

kubectl create secret generic "${topology_secret_name}" \
  --namespace "${namespace}" \
  --from-literal="DB_USER=${topology_db_user}" \
  --from-literal="DB_PASSWORD=${topology_db_password}" \
  --from-literal="NEO4J_AUTH=${topology_db_user}/${topology_db_password}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "Kubernetes secret ${topology_secret_name}/${namespace} synchronized."

# ---------------------------------------------------------
# 2. COMPLIANCE DB (PostgreSQL)
# ---------------------------------------------------------
compliance_secret_name="compliance-db-credentials"
compliance_env_file="services/core/compliance-service/.env"
compliance_db_user=$(load_env_val "$compliance_env_file" "DB_USER" "postgres")
compliance_db_password=$(load_env_val "$compliance_env_file" "DB_PASSWORD" "$(openssl rand -hex 24)")

kubectl create secret generic "${compliance_secret_name}" \
  --namespace "${namespace}" \
  --from-literal="DB_USER=${compliance_db_user}" \
  --from-literal="DB_PASSWORD=${compliance_db_password}" \
  --from-literal="POSTGRES_USER=${compliance_db_user}" \
  --from-literal="POSTGRES_PASSWORD=${compliance_db_password}" \
  --from-literal="POSTGRES_DB=compliance" \
  --from-literal="DATABASE_URL=postgresql://${compliance_db_user}:${compliance_db_password}@compliance-db:5432/compliance" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "Kubernetes secret ${compliance_secret_name}/${namespace} synchronized."

# ---------------------------------------------------------
# 2b. AUDIT LEDGER DB (MongoDB)
# ---------------------------------------------------------
audit_secret_name="audit-db-credentials"
audit_env_file="services/core/audit-ledger/.env"
audit_db_user=$(load_env_val "$audit_env_file" "DB_USER" "mongo")
audit_db_password=$(load_env_val "$audit_env_file" "DB_PASSWORD" "$(openssl rand -hex 24)")

kubectl create secret generic "${audit_secret_name}" \
  --namespace "${namespace}" \
  --from-literal="DB_USER=${audit_db_user}" \
  --from-literal="DB_PASSWORD=${audit_db_password}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "Kubernetes secret ${audit_secret_name}/${namespace} synchronized."

# ---------------------------------------------------------
# 3. MINIO (S3 Object Storage)
# ---------------------------------------------------------
minio_secret_name="minio-credentials"
esign_env_file="services/platform/esign-service/.env"
minio_access_key=$(load_env_val "$esign_env_file" "S3_ACCESS_KEY" "minioadmin")
minio_secret_key=$(load_env_val "$esign_env_file" "S3_SECRET_KEY" "minioadmin")

kubectl create secret generic "${minio_secret_name}" \
  --namespace "${namespace}" \
  --from-literal="S3_ACCESS_KEY=${minio_access_key}" \
  --from-literal="S3_SECRET_KEY=${minio_secret_key}" \
  --from-literal="MINIO_ROOT_USER=${minio_access_key}" \
  --from-literal="MINIO_ROOT_PASSWORD=${minio_secret_key}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "Kubernetes secret ${minio_secret_name}/${namespace} synchronized."

# ---------------------------------------------------------
# 4. ESIGN SERVICE SECRETS (Certs & Signing Password)
# ---------------------------------------------------------
esign_secret_name="esign-secrets"
cert_path="services/platform/esign-service/server/certs/certificate.p12"
signing_password=$(load_env_val "$esign_env_file" "SIGNING_CERT_PASSWORD" "changeit")

if [[ -f "$cert_path" ]]; then
  kubectl create secret generic "${esign_secret_name}" \
    --namespace "${namespace}" \
    --from-file="certificate.p12=${cert_path}" \
    --from-literal="SIGNING_CERT_PASSWORD=${signing_password}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  echo "Kubernetes secret ${esign_secret_name}/${namespace} synchronized with binary certificate."
else
  echo "Warning: Signing certificate not found at ${cert_path}. Skipping file binding for ${esign_secret_name}." >&2
fi

# ---------------------------------------------------------
# AUTH KEYS (RS256): private key only for auth-server, public key for verifying servers
# ---------------------------------------------------------
auth_key_dir=".auth-keys"
if [[ ! -f "${auth_key_dir}/private.pem" ]]; then
  bash scripts/generate-auth-keys.sh
fi

kubectl create secret generic "auth-signing-key" \
  --namespace "${namespace}" \
  --from-file="private.pem=${auth_key_dir}/private.pem" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl create secret generic "auth-public-key" \
  --namespace "${namespace}" \
  --from-file="public.pem=${auth_key_dir}/public.pem" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
echo "Kubernetes secrets auth-signing-key and auth-public-key/${namespace} synchronized."
