# Credentials, accounts, and resets

The platform uses the same per-service account model in Compose and Kubernetes:
MinIO root and each service have distinct credentials, as do the PostgreSQL and
MongoDB administrator and application users. The signing password must match the
local P12 certificate. Reconcile errors before starting.

## Generated local credentials

Per-workload generated files in the ignored `.auth-keys/local/` directory feed
Compose and local Kubernetes; exported shell DB, S3 and signing-password
variables do not override those credentials. Non-secret Compose settings can
still be overridden as usual.

The local directory is a symlink to a protected, atomically published
generation in `.auth-keys/local-generations/`. Old generations remain for
readers that may already be using them and contain old credentials: protect
them and remove unneeded generations only after stopping concurrent preparation
and deployments. If preparation reports a stale `.local-credentials.lock`,
verify no preparation is running before removing that lock directory. NATS
passwords live separately in `.auth-keys/nats/`; JWT keys and the P12
certificate retain their existing locations. Preserve and back up matching key
and password files; partial NATS or JWT material is rejected rather than
silently replaced. The `.auth-keys` directory is private to the host user. Do
not commit these credentials. Any old topology key in the root `.env` is left
untouched but is no longer used.

For local Kubernetes, `pnpm k8s:secrets` creates matching broker and
per-service Secrets if absent. It refuses to overwrite an existing Secret that
differs from the local credentials. Older broker Secrets may retain an unused
admin key; it is ignored and need not be deleted. Coordinate credential
rotation across the broker and services, and use a secure secret manager
outside local development.

## Service accounts and data access

MinIO root credentials are available only to the MinIO server and setup job.
Applications use their own `minio-<service>-credentials` Secrets. PostgreSQL
and MongoDB administrators likewise have separate Secrets from their
application users; DBGate uses the application accounts and inherits their
restrictions. Setup jobs verify existing accounts rather than rotating
passwords or silently replacing conflicting policies. Kubernetes application
startup waits for the provisioned database and MinIO accounts. The MinIO setup
reserves a `.dsap-ready` object under each authorized prefix for this readiness
check. Changing a Secret is not a database, MinIO, or NATS password rotation.

Database and MinIO setup jobs have configurable `setupResources` requests and
limits, including ephemeral storage. Service readiness init containers also
have resource settings in their server chart values. These are starting points
to adjust for the cluster; ephemeral storage is not a persistent volume.
MinIO provisioning also uses `dsap/.dsap-provision-lock` to serialize setup.
If an interrupted provisioner leaves this object behind, first confirm that no
setup job or container is running, inspect the lock using an administrator
interface, and explicitly remove only that lock before retrying. Do not remove
the lock while another provisioner may be active.

| Identity | Data access |
| --- | --- |
| Compliance | Reads `dsap/compliance/drafts/` and `dsap/compliance/transfers/`; PostgreSQL application account can create and manage its schema but cannot administer roles or databases. |
| Audit | Reads `dsap/audit/transfers/`; MongoDB application account can read and insert ledger events, sealed transfers and dead letters, but cannot update or delete them. Drafts and rendition state remain mutable. |
| PDF and e-sign | Separate MinIO identities read and write the allowed compliance and audit prefixes; neither can delete objects. Request validation and NATS permissions constrain which operations callers can invoke. |
| Database and storage administrators | Initialize accounts, policies and indexes; credentials are not supplied to application servers or DBGate. |

These are **service** accounts: a profile selected in the UI is authorized by
application services, not by a separate database login. Neo4j Community
Edition uses a shared service identity, so its profile restrictions are
enforced in the application. MongoDB append-only access protects against
updates and deletes by the application account, not by administrators or
against false inserts. MinIO write permission is not itself immutability;
document creation uses conditional writes. DBGate is a local administrative
interface and must not be exposed publicly.

## Deliberate, data-preserving credential changes

For a deliberate, data-preserving local credential change, back up the existing
credentials and data first. Use the relevant administrator tools to provision
or rotate the backing accounts and their exact policies/roles; for PostgreSQL,
reconcile application-object ownership explicitly if changing the runtime
username. Update the corresponding local `.env` files, then stop all
recognized Compose projects. Only after the backing accounts are ready, publish
the new local files with the explicit confirmation below:

```bash
python3 scripts/dev-env/prepare-local-compose.py --accept-provisioned-credentials
```

This command refuses running Compose containers and **does not** change any
backing account or Kubernetes Secret. On restart the setup jobs verify the
credentials and policies and fail on conflicts. For Kubernetes, coordinate
Secret changes with the backing services separately using a secure operator
workflow; normal `pnpm k8s:secrets` refuses to overwrite conflicting Secrets.
Retain the old material until the new accounts and recovery procedure have
been verified.

## Reset disposable Compose data

Changing a password in `.env` and preparing credentials does **not** change an
already-initialized database or MinIO account. Normal setup and startup never
delete data. If local Compose state is disposable, first preview the reset:

```bash
pnpm dev:reset:compose --project distributed-systems-architecture-portfolio
```

The project name above is the standard Compose project for a checkout with the
repository's default directory name. `dsap-local` is also supported when
explicitly selected using `docker compose -p dsap-local`. The preview lists
the exact containers and volumes, and refuses an unexpected project, foreign
workspace, unknown volume, or unverifiable orphaned volumes. It uses the
current Docker context; check that context before proceeding. To remove the
listed state, repeat the command with `--execute` and type the displayed
confirmation:

```bash
pnpm dev:reset:compose --project distributed-systems-architecture-portfolio --execute
pnpm dev:prepare
docker compose up --build -d
```

This deletes the listed Neo4j, PostgreSQL, MongoDB, MinIO, JetStream and DBGate
data, including documents and event history, but retains `.env` files and keys.
For the alternate project, include `-p dsap-local` when starting Compose.
Kubernetes is not affected. Kubernetes Secret conflicts require recovery or a
separately coordinated reset of the local cluster's workloads and data; this
command does not reset Kubernetes. Resetting only one deployment or part of the
platform can leave database, object and event histories inconsistent.
Legacy local Kubernetes Secrets containing shared administrator credentials are
rejected. Preserve or export the data and original credentials before manually
coordinating any local cluster reset; this bootstrap does not delete Kubernetes
Secrets or PVCs. Existing PostgreSQL objects owned by the legacy account also
require explicit ownership reconciliation before the new runtime role can use
them; provisioning refuses to take ownership automatically.

## Reset disposable local Kubernetes state

For a **disposable** local Kubernetes reset, stop Skaffold and any other
controller that can recreate workloads. Verify the context, review the
releases, workloads, claims and Secrets, and back up anything to retain:

```bash
kubectl config current-context
helm --kube-context k3d-platform-cluster -n platform-local list
kubectl --context k3d-platform-cluster -n platform-local get deployments,jobs,pods,pvc,secrets
```

Only if you have decided to discard the entire local platform state, remove
the platform releases below. Older releases may not have the PVC-retention
annotation, so their uninstallation can itself delete data. Inspect their
manifests and PVCs before running this command:

```bash
helm --kube-context k3d-platform-cluster -n platform-local uninstall --ignore-not-found \
  topology-service compliance-service audit-ledger pdf-service esign-service \
  auth-service topology-shell compliance-shell global-shell minio nats dbgate network-policies
```

Confirm that the listed platform writers have stopped. Then explicitly remove
the named remaining claims and scoped database/MinIO Secrets; this permanently
deletes graph, compliance, audit, object, event and DBGate data. JWT, NATS and
signing Secrets are intentionally retained. Do not run these commands against
the demo or another context:

```bash
kubectl --context k3d-platform-cluster -n platform-local delete pvc --ignore-not-found \
  topology-db compliance-db audit-db minio nats dbgate
kubectl --context k3d-platform-cluster -n platform-local delete secret --ignore-not-found \
  topology-db-credentials compliance-db-credentials compliance-db-admin-credentials \
  audit-db-credentials audit-db-admin-credentials minio-credentials \
  minio-compliance-credentials minio-audit-credentials minio-esign-credentials minio-pdf-credentials
pnpm k8s:secrets
```

After confirming the current context is still `k3d-platform-cluster`, redeploy
the local releases. A reset of only some stores can leave histories
inconsistent. This procedure is manual, context-specific and separate from
normal startup; it does not delete the namespace or cluster.
