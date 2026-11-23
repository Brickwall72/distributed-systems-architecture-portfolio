# Topology service

Owns the Neo4j custody graph: organizations, assets, custody relationships,
transfer claims, and transfer progress. It is the authority other services
consult for organization and asset facts, and the only service that mutates
custody.

## Responsibilities and data flow

- Serves profile-scoped organization, asset, and graph reads over HTTP under
  `/api/v1` (health at `GET /api/v1/health`, liveness at `GET /live`).
- Validates compliance draft facts and atomically reserves assets for
  authorization and receipt signing through queue-group NATS request/reply
  responders. Reservation checks lock assets and requisitions and bind the
  claim to its document and parties; overlapping claims conflict, and exact
  retries reuse the same claim and transfer ID. Reservations do not expire
  automatically — see the
  [compliance README](../compliance-service/README.md) for recovery.
- Consumes durable signed-transfer events from compliance, validates each event
  against its reservation, and applies physical, partial-receipt, or C2 custody
  transitions atomically. Redelivery of an identical signed event is
  idempotent.
- Publishes committed transfer results through an ordered, transactionally
  recorded Neo4j outbox. Compliance consumes the results to reconcile document
  synchronization state; audit consumes the snapshots for sealing.
- Ensures its own JetStream event stream at startup and creates/verifies its
  own durable consumer for compliance's signed events. It does not expose its
  ready health route until that consumer initializes.

## Data store

Neo4j Community Edition holds the graph, transfer claims, and the outbox.
Community Edition has no per-user graph permissions, so the service connects
with its own database credentials and enforces profile and organization
access at the application boundary; signing into the UI does not create a
database user.

Startup seeds fictional organizations and at least twelve available assets
when the graph has no topology entities; it never replaces existing graphs or
reassigns custody on restart. The Kubernetes chart stores Neo4j data on a PVC
(Recreate strategy; see
[Kubernetes development](../../../docs/development/kubernetes-development.md)
for the storage-transition guard); Compose uses a named volume.

## Configuration

[`server/src/config.ts`](./server/src/config.ts) validates `PORT` (default
`8080`), `NATS_URL` (default `nats://localhost:4222`), and `NODE_ENV` (default
`development`). NATS credentials are loaded separately at startup. If changing
`PORT`, also align the container port mappings and health probes.

## Frontend

The client exposes the federated widgets `AssetRegistration`, `NetworkCanvas`,
`AssetSelector`, and `OrganizationSelector` (`topology_client` in the global
shell registry); the [topology shell](../../../ui-shells/README.md) composes
them into pages. The current custodian and the intended receiver of an
in-transit asset can view its complete visual history. On the network canvas,
drag individual nodes or Shift-drag a node to move it and its directly
connected neighbors; arrangements last only while that canvas is open.

## Local development

Compose services: `topology-db` (Neo4j browser `7474`, Bolt `7687`),
`topology-server`, and `topology-client` (internal ports `8080`/`3000`,
reached through Traefik). A `compose.dev.yaml` override exists for
`make dev svcs=services/core/topology-service`.

- Workspaces: `topology-client`, `topology-server`, `topology-shared`.
- `pnpm --filter topology-server test:unit` / `test:integration` /
  `test:verify`; `pnpm --filter topology-client test:unit` / `test:contract`.
- Integration tests need isolated Neo4j databases — see the
  [server test README](./server/README.md) and the
  [testing guide](../../../docs/development/testing.md).
