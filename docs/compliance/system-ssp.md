# System security overview

This is a fictional demonstration, not a certified system security plan or
evidence of compliance. Use fictional data only. Controls depend on the
deployment and should be verified before exposing any installation.

## Identity and authorization

The auth service issues signed JWTs; topology, compliance, and audit verify
them and enforce application-level roles and organization scopes. The demo
profile picker permits callers to select seeded identities and is not
production authentication. See the [auth service](../../services/platform/auth-service/README.md)
and [transfer workflow](../architecture/transfer-workflow.md).

## Storage and messaging

Compose and Kubernetes use separate service identities for MinIO and separate
application and administrator database accounts. MinIO's bucket is private,
but presigned URLs are bearer capabilities until they expire. MongoDB
restrictions prevent the audit application account from updating or deleting
sealed records; they do not prevent administrator changes or false inserts.
Neo4j profile restrictions are enforced by the application, not database
roles. See [credentials and resets](../development/credentials-and-resets.md).

NATS uses service-specific credentials, subject permissions, and reply
inboxes. Local NATS connections are plaintext; the system does not claim mTLS,
per-event cryptographic publisher attestations, or encrypted storage volumes.
Kubernetes network policies require an enforcing network plugin and
deployment-specific verification; local Compose exposes development ports.

## Public demo precautions

The demo has separate credentials and a fictional signing certificate. A
public deployment requires its own TLS, network isolation, protected
credentials and backups, and verification of exposed routes. Do not expose
DBGate or management dashboards. See [demo secrets](../operations/demo-secrets.md)
and the [operations guide](../operations/).
