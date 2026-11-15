#!/usr/bin/env bash
# File: scripts/test-integration.sh
# Credentials below are disposable fixtures for this isolated integration project.
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

"${compose[@]}" up -d --wait --wait-timeout 180 neo4j seed-neo4j postgres postgres-trust mongo nats nats-auth minio
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
export AUDIT_TEST_MONGO_URI="mongodb://integration-audit:integration-audit-password@127.0.0.1:$(port mongo 27017)/audit?authSource=admin"
export COMPLIANCE_RUNTIME_TEST_DATABASE_URL="postgresql://integration_runtime:integration-runtime-password@127.0.0.1:$(port postgres 5432)/compliance_runtime_test"
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

"${compose[@]}" build minio-policy-setup
if "${compose[@]}" run --rm --no-deps -e S3_ACCESS_KEY=compliance-test \
    -e S3_SECRET_KEY=compliance-test-password -e MINIO_READY_PREFIX=compliance/drafts/ \
    minio-policy-setup --check-ready; then
  echo 'MinIO readiness unexpectedly succeeded before account provisioning.' >&2
  exit 1
fi
"${compose[@]}" run --rm --no-deps minio-policy-setup
"${compose[@]}" run --rm --no-deps minio-policy-setup
for service in compliance audit pdf esign; do
  case "$service" in
    compliance|pdf) prefix=compliance/drafts/ ;;
    audit) prefix=audit/transfers/ ;;
    esign) prefix=compliance/transfers/ ;;
    *) echo "Unexpected integration service: $service" >&2; exit 1 ;;
  esac
  "${compose[@]}" run --rm --no-deps -e "S3_ACCESS_KEY=${service}-test" \
    -e "S3_SECRET_KEY=${service}-test-password" -e "MINIO_READY_PREFIX=$prefix" \
    minio-policy-setup --check-ready
done
if "${compose[@]}" run --rm --no-deps -e S3_ACCESS_KEY=audit-test \
    -e S3_SECRET_KEY=audit-test-password -e MINIO_READY_PREFIX=compliance/drafts/ \
    minio-policy-setup --check-ready; then
  echo 'MinIO readiness unexpectedly permitted an unauthorized prefix.' >&2
  exit 1
fi
if output=$("${compose[@]}" run --rm --no-deps -e COMPLIANCE_SECRET_KEY=wrong-password minio-policy-setup 2>&1); then
  echo 'MinIO provisioning unexpectedly accepted an incorrect service password.' >&2
  exit 1
elif [[ "$output" != *"do not authenticate"* ]]; then
  printf 'Unexpected MinIO provisioning failure: %s\n' "$output" >&2
  exit 1
fi
mc_admin=(run --rm --no-deps -e MC_HOST_admin=http://integration:integration-password@minio:9000
  --entrypoint mc minio-policy-setup --config-dir /tmp/dsap-mc)
"${compose[@]}" "${mc_admin[@]}" admin policy detach admin dsap-compliance-v1 --user compliance-test
"${compose[@]}" run --rm --no-deps minio-policy-setup
"${compose[@]}" "${mc_admin[@]}" admin policy create admin dsap-worker-v1 /opt/dsap-minio/policies/audit.json
if output=$("${compose[@]}" run --rm --no-deps minio-policy-setup 2>&1); then
  echo 'MinIO provisioning unexpectedly accepted a conflicting policy.' >&2
  exit 1
elif [[ "$output" != *"conflicts with the expected policy"* ]]; then
  printf 'Unexpected MinIO provisioning failure: %s\n' "$output" >&2
  exit 1
fi
"${compose[@]}" "${mc_admin[@]}" admin policy create admin dsap-worker-v1 /opt/dsap-minio/policies/worker.json
"${compose[@]}" "${mc_admin[@]}" admin group add admin test-conflict compliance-test
if output=$("${compose[@]}" run --rm --no-deps minio-policy-setup 2>&1); then
  echo 'MinIO provisioning unexpectedly accepted an extra group membership.' >&2
  exit 1
elif [[ "$output" != *"conflicting policies, groups, or status"* ]]; then
  printf 'Unexpected MinIO provisioning failure: %s\n' "$output" >&2
  exit 1
fi
"${compose[@]}" "${mc_admin[@]}" admin group remove admin test-conflict compliance-test
"${compose[@]}" run --rm --no-deps -e MC_HOST_admin=http://integration:integration-password@minio:9000 \
  --entrypoint /bin/sh minio-policy-setup -c 'printf held-lock | mc --config-dir /tmp/dsap-mc pipe admin/dsap/.dsap-provision-lock'
if output=$("${compose[@]}" run --rm --no-deps minio-policy-setup 2>&1); then
  echo 'MinIO provisioning unexpectedly acquired an existing lock.' >&2
  exit 1
elif [[ "$output" != *"provisioning lock exists"* ]]; then
  printf 'Unexpected MinIO provisioning failure: %s\n' "$output" >&2
  exit 1
fi
lock_content=$("${compose[@]}" "${mc_admin[@]}" cat admin/dsap/.dsap-provision-lock)
if [[ "$lock_content" != held-lock ]]; then
  echo 'MinIO provisioning modified an existing lock.' >&2
  exit 1
fi
"${compose[@]}" "${mc_admin[@]}" rm admin/dsap/.dsap-provision-lock
"${compose[@]}" run --rm --no-deps minio-policy-setup
if output=$("${compose[@]}" exec -T \
  -e PGHOST=postgres-trust -e PGPORT=5432 -e PGUSER=integration -e PGPASSWORD=integration \
  -e PGDATABASE=integration -e COMPLIANCE_RUNTIME_USER=integration_runtime \
  -e COMPLIANCE_RUNTIME_PASSWORD=integration-runtime-password postgres-trust sh /tmp/provision-compliance-postgres.sh 2>&1); then
  echo 'PostgreSQL provisioning unexpectedly accepted host trust authentication.' >&2
  exit 1
elif [[ "$output" != *"trust rules"* ]]; then
  printf 'Unexpected PostgreSQL provisioning failure: %s\n' "$output" >&2
  exit 1
fi
"${compose[@]}" exec -T postgres createdb -U integration compliance_runtime_test
postgres_provision=(exec -T
  -e PGHOST=postgres -e PGPORT=5432 -e PGUSER=integration -e PGPASSWORD=integration
  -e PGDATABASE=compliance_runtime_test -e COMPLIANCE_RUNTIME_USER=integration_runtime
  -e COMPLIANCE_RUNTIME_PASSWORD=integration-runtime-password postgres sh /tmp/provision-compliance-postgres.sh)
"${compose[@]}" "${postgres_provision[@]}"
"${compose[@]}" "${postgres_provision[@]}"
if output=$("${compose[@]}" exec -T \
  -e PGHOST=postgres -e PGPORT=5432 -e PGUSER=integration -e PGPASSWORD=integration \
  -e PGDATABASE=compliance_runtime_test -e COMPLIANCE_RUNTIME_USER=integration_runtime \
  -e COMPLIANCE_RUNTIME_PASSWORD=wrong-password postgres sh /tmp/provision-compliance-postgres.sh 2>&1); then
  echo 'PostgreSQL provisioning unexpectedly accepted an incorrect runtime password.' >&2
  exit 1
elif [[ "$output" != *"failed authentication"* ]]; then
  printf 'Unexpected PostgreSQL provisioning failure: %s\n' "$output" >&2
  exit 1
fi
mongo_admin=(mongosh --quiet --host localhost --authenticationDatabase admin \
  --username integration-admin --password integration-admin-password)
"${compose[@]}" exec -T mongo "${mongo_admin[@]}" /tmp/provision-audit-mongo.js
"${compose[@]}" exec -T mongo "${mongo_admin[@]}" /tmp/provision-audit-mongo.js
"${compose[@]}" exec -T mongo mongosh --quiet /tmp/test-audit-mongo-authorization.js
pnpm --filter audit-server exec vitest run .integration.test --no-file-parallelism
if output=$("${compose[@]}" exec -T -e AUDIT_RUNTIME_PASSWORD=wrong-password mongo "${mongo_admin[@]}" /tmp/provision-audit-mongo.js 2>&1); then
  echo 'MongoDB provisioning unexpectedly accepted an incorrect runtime password.' >&2
  exit 1
elif [[ "$output" != *"Authentication failed"* ]]; then
  printf 'Unexpected MongoDB provisioning failure: %s\n' "$output" >&2
  exit 1
fi
"${compose[@]}" exec -T mongo "${mongo_admin[@]}" --eval \
  'db.getSiblingDB("audit").events.createIndex({expiresAt: 1}, {expireAfterSeconds: 30})'
if output=$("${compose[@]}" exec -T mongo "${mongo_admin[@]}" /tmp/provision-audit-mongo.js 2>&1); then
  echo 'MongoDB provisioning unexpectedly accepted a TTL index on an append-only collection.' >&2
  exit 1
elif [[ "$output" != *"has a TTL index"* ]]; then
  printf 'Unexpected MongoDB provisioning failure: %s\n' "$output" >&2
  exit 1
fi
"${compose[@]}" exec -T mongo "${mongo_admin[@]}" --eval \
  'db.getSiblingDB("audit").events.dropIndex("expiresAt_1")'
"${compose[@]}" exec -T mongo "${mongo_admin[@]}" --eval \
  'db.getSiblingDB("audit").grantPrivilegesToRole("dsapAuditRuntime", [{resource: {db: "audit", collection: "events"}, actions: ["update"]}])'
if output=$("${compose[@]}" exec -T mongo "${mongo_admin[@]}" /tmp/provision-audit-mongo.js 2>&1); then
  echo 'MongoDB provisioning unexpectedly accepted broadened privileges.' >&2
  exit 1
elif [[ "$output" != *"conflicts with the expected privileges"* ]]; then
  printf 'Unexpected MongoDB provisioning failure: %s\n' "$output" >&2
  exit 1
fi

pnpm --filter topology-server exec vitest run .integration.test --no-file-parallelism
for statement in 'SHOW ROLES' 'CREATE ROLE demo_reader' 'GRANT MATCH {*} ON GRAPH neo4j NODES * TO demo_reader'; do
  if output=$("${compose[@]}" exec -T seed-neo4j cypher-shell -a bolt://localhost:7687 "$statement" 2>&1); then
    echo "Neo4j Community unexpectedly accepted role administration: $statement" >&2
    exit 1
  elif [[ "$output" != *"Unsupported administration command"* ]]; then
    printf 'Unexpected Neo4j administration failure: %s\n' "$output" >&2
    exit 1
  fi
done
"${compose[@]}" restart seed-neo4j
"${compose[@]}" up -d --wait --wait-timeout 180 seed-neo4j
seed_owner=$("${compose[@]}" exec -T seed-neo4j cypher-shell -a bolt://localhost:7687 --format plain \
  "MATCH (o:Organization)-[:HAS_CUSTODY]->(:Asset {id: 'asset-heavy-lifter-tanks'}) RETURN o.id AS owner")
if [[ "$seed_owner" != *"org-ksc-gov"* ]]; then
  echo "Neo4j seed data or updated custody did not persist across restart." >&2
  exit 1
fi
pnpm --filter compliance-server exec vitest run .integration.test --no-file-parallelism
"${compose[@]}" exec -T postgres createdb -U integration legacy_compliance_test
"${compose[@]}" exec -T postgres psql -U integration -d legacy_compliance_test \
  -c 'CREATE TABLE retained_data (id integer)'
if output=$("${compose[@]}" exec -T \
  -e PGHOST=postgres -e PGPORT=5432 -e PGUSER=integration -e PGPASSWORD=integration \
  -e PGDATABASE=legacy_compliance_test -e COMPLIANCE_RUNTIME_USER=legacy_runtime \
  -e COMPLIANCE_RUNTIME_PASSWORD=integration-runtime-password postgres sh /tmp/provision-compliance-postgres.sh 2>&1); then
  echo 'PostgreSQL provisioning unexpectedly accepted legacy administrator-owned objects.' >&2
  exit 1
elif [[ "$output" != *"not owned by the runtime role"* ]]; then
  printf 'Unexpected PostgreSQL provisioning failure: %s\n' "$output" >&2
  exit 1
fi
legacy_role=$("${compose[@]}" exec -T postgres psql -U integration -d legacy_compliance_test -tA \
  -c "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'legacy_runtime')")
if [[ "$legacy_role" != f ]]; then
  echo 'PostgreSQL provisioning modified the legacy database before rejecting it.' >&2
  exit 1
fi
"${compose[@]}" exec -T postgres psql -U integration -d compliance_runtime_test \
  -c 'ALTER ROLE integration_runtime CREATEROLE'
if output=$("${compose[@]}" "${postgres_provision[@]}" 2>&1); then
  echo 'PostgreSQL provisioning unexpectedly accepted an overprivileged runtime role.' >&2
  exit 1
elif [[ "$output" != *"overprivileged"* ]]; then
  printf 'Unexpected PostgreSQL provisioning failure: %s\n' "$output" >&2
  exit 1
fi
pnpm --filter @shared/messaging exec vitest run .integration.test --no-file-parallelism
pnpm --filter @shared/filestore exec vitest run .integration.test --no-file-parallelism
pnpm --filter esign-server exec vitest run .integration.test --no-file-parallelism
