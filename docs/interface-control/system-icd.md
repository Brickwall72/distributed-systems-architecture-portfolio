# System interface overview

This overview describes the current custody-transfer interfaces. The
TypeScript contracts and route implementations linked below are the source of
truth for request schemas, responses, and authorization. See also the
[transfer workflow](../architecture/transfer-workflow.md).

## Browser and HTTP

Traefik routes the local Compose application at `http://localhost` and the
local k3d application at `http://localhost:8081`. The global shell loads
[`/registry/apps.json`](../../ui-shells/global-shell/public/registry/apps.json)
and initializes the federated domain shells and clients. Compose and k3d can
still conflict on other published ports; do not run both on the same ports.

Backend routes are mounted under `/api/v1`; Traefik supplies the service
prefix. All six servers provide `GET /api/v1/health`. Representative
application routes, shown with their external prefixes:

| Service | Routes | Contract |
| --- | --- | --- |
| Auth | `POST /auth/api/v1/session`, `GET /auth/api/v1/identities/me/signature` | [Auth](../../services/platform/auth-service/shared/src/contracts/auth.contract.ts) |
| Topology | `GET /topology/api/v1/organizations`, `GET` and `POST /topology/api/v1/assets`, `GET /topology/api/v1/graph` | [Topology](../../services/core/topology-service/shared/src/contracts/) |
| Compliance | `GET /compliance/api/v1/templates`, `GET /templates/:id`, `POST /templates/:id/drafts`, document reads and `POST /documents/sign` under `/compliance/api/v1` | [Compliance](../../services/core/compliance-service/shared/src/contracts/) |
| Audit | `GET /audit/api/v1/transfers`, `GET /audit/api/v1/transfers/:requisitionNumber/document` | [Audit](../../services/core/audit-ledger/shared/src/contracts/transfers.contract.ts) |

PDF generation and e-signing use NATS request/reply, not HTTP document
generation or signing endpoints. The core servers also expose `/live` for
liveness. Protected routes use JWTs; the demo login is impersonable.

HTTP requests receive an `x-correlation-id` response header. An accepted ID
may contain 1–128 ASCII letters, digits, `.`, `_`, `:`, or `-`; missing or
invalid IDs are replaced. Immediate NATS request/reply calls propagate the
context, but durable retries and deliveries do not preserve a continuous
request trace. See [observability](../development/observability.md) for
validation and logging details.

## NATS interfaces

Compliance requests draft validation and reservations from topology, PDF
generation from PDF, and signing from e-sign via request/reply. PDF subjects
are `pdf.command.generate-draft` and `pdf.command.generate-audit`; e-sign
uses `esign.command.sign-document`. Subject constants and payload schemas
are defined in [contracts](../../packages/contracts/), including
[topology requests](../../packages/contracts/topology/src/transfer-requests.schema.ts),
[PDF requests](../../packages/contracts/pdf/src/messaging/request-response.schema.ts),
and [e-sign requests](../../packages/contracts/esign/src/messaging/request-response.schema.ts).

Compliance persists signed-transfer and document-event intents in its outbox.
Topology consumes `events.compliance.transfer.signed`, applies the reserved
transition, and publishes results through its own outbox. Audit consumes
independently delivered events using durable consumers:

| Stream | Subject | Durable consumer |
| --- | --- | --- |
| `TOPOLOGY_EVENTS` | `events.topology.transfer.created` | `audit-ledger-transfer-created-consumer` |
| `TOPOLOGY_EVENTS` | `events.topology.transfer.updated` | `audit-ledger-transfer-updated-consumer` |
| `TOPOLOGY_EVENTS` | `events.topology.transfer.completed` | `audit-ledger-transfer-completed-consumer` |
| `COMPLIANCE_EVENTS` | `events.compliance.transfer.initiated` | `audit-ledger-transfer-initiated-consumer` |
| `COMPLIANCE_EVENTS` | `events.compliance.transfer.received` | `audit-ledger-transfer-received-consumer` |

Event schemas are in the [topology](../../packages/contracts/topology/src/messaging/events.schema.ts)
and [compliance](../../packages/contracts/compliance/src/messaging/events.schema.ts)
contracts. Audit dead-letters malformed events and acknowledges them; service
failures trigger delayed redelivery. Retention and service availability still
affect delivery. See the [audit service README](../../services/core/audit-ledger/README.md)
for accumulation and sealing.
