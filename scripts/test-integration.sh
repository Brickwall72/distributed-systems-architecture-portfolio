#!/usr/bin/env bash
# File: scripts/test-integration.sh
set -euo pipefail
cd "$(dirname "$0")/.."

project="integration-$(openssl rand -hex 8)"
compose=(docker compose -p "$project" -f scripts/integration-compose.yaml)
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if ! "${compose[@]}" down --volumes --remove-orphans; then
    echo "Failed to clean up integration project $project." >&2
    if (( status == 0 )); then status=1; fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command in docker pnpm openssl curl; do
  if ! command -v "$command" >/dev/null; then
    echo "Integration tests require $command." >&2
    exit 1
  fi
done

pnpm exec turbo run build \
  --filter='topology-server^...' \
  --filter='compliance-server^...' \
  --filter='audit-server^...' \
  --filter='@shared/filestore^...' \
  --filter='esign-server^...'

"${compose[@]}" up -d --wait --wait-timeout 180 neo4j seed-neo4j postgres nats nats-auth minio
port() {
  local address
  address=$("${compose[@]}" port "$1" "$2")
  printf '%s' "${address##*:}"
}
export GRAPH_TEST_NEO4J_URI="bolt://127.0.0.1:$(port neo4j 7687)"
export CLAIM_TEST_NEO4J_URI="$GRAPH_TEST_NEO4J_URI"
export SEED_TEST_NEO4J_URI="bolt://127.0.0.1:$(port seed-neo4j 7687)"
export COMPLIANCE_TEST_DATABASE_URL="postgresql://integration:integration@127.0.0.1:$(port postgres 5432)/integration"
export SIGNING_TEST_NATS_URL="nats://127.0.0.1:$(port nats 4222)"
export AUTH_TEST_NATS_URL="nats://127.0.0.1:$(port nats-auth 4222)"
export MINIO_TEST_ENDPOINT="http://127.0.0.1:$(port minio 9000)"
export MINIO_TEST_ACCESS_KEY=integration
export MINIO_TEST_SECRET_KEY=integration-password

ready=false
for (( attempt=0; attempt<60; attempt++ )); do
  if curl --silent --fail "$MINIO_TEST_ENDPOINT/minio/health/ready" >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Integration MinIO did not become ready." >&2
  exit 1
fi

pnpm --filter topology-server exec vitest run .integration.test --no-file-parallelism
pnpm --filter compliance-server exec vitest run .integration.test --no-file-parallelism
pnpm --filter @shared/messaging exec vitest run .integration.test --no-file-parallelism
pnpm --filter @shared/filestore exec vitest run .integration.test --no-file-parallelism
pnpm --filter esign-server exec vitest run .integration.test --no-file-parallelism
