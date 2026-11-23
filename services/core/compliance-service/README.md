# Compliance service

Coordinates the document side of a custody transfer: templates, draft
generation, signing, participant access, and durable publication of signed
events. PostgreSQL is its system of record; topology remains the custody
authority.

## Responsibilities and data flow

- Serves template and document routes over HTTP under `/api/v1` (health at
  `GET /api/v1/health`, liveness at `GET /live`), including
  `POST /templates/:id/drafts` for draft creation.
- Validates draft input against topology over synchronous NATS request/reply
  and binds the draft to its creator, transfer details, and content hash. PDF
  generation is a synchronous request to the
  [PDF generator](../../platform/pdf-generator/README.md).
- On signing, persists a signing operation, requests an atomic topology
  reservation, requests the signature from
  [e-sign](../../platform/esign-service/README.md), then transactionally
  records the signed result, document, participant data, and two event
  intents: a signed-transfer event for topology and an initiated/received
  document event for audit. A durable outbox retries publication.
- Consumes topology result events to update each document's synchronization
  state (pending, applied, or attention required) without regressing a later
  state. Ensures its own JetStream event stream at startup.
- Stores documents' `storage_bucket`/`storage_key` and issues time-limited
  presigned download URLs from the browser-reachable S3 endpoint.

Signing is durable and may continue after a timeout; retry the identical
request rather than creating a replacement signature. An unresolved signing
operation retains its signature image in the database until completion or a
pre-signing conflict. Never discard an uncertain operation or release its
signing claim without first reconciling the signed artifact and topology state.

## Data store

PostgreSQL holds documents, participant access, signing operations, and the
signed-event outbox. The application account can create and manage its schema
but cannot administer roles or databases; see
[credentials and resets](../../../docs/development/credentials-and-resets.md)
for the account model. Object storage uses the `dsap` bucket prefixes
`compliance/drafts/` and `compliance/transfers/`.

## Signing and synchronization recovery

The database twin shows signed documents even while topology is unavailable.
The topology and compliance outboxes retry publication; topology also retries
rejected signed events. Check service logs and the following read-only local
queries when synchronization needs attention:

```bash
docker compose exec compliance-db sh -c \
  'psql -U "$POSTGRES_USER" -d compliance -c "SELECT document_id, state, last_error_code, updated_at FROM compliance_signing_operations WHERE state <> '\''COMPLETED'\'' ORDER BY updated_at;"'
docker compose exec compliance-db sh -c \
  'psql -U "$POSTGRES_USER" -d compliance -c "SELECT document_id, subject, last_error, next_attempt_at FROM compliance_signed_outbox WHERE published_at IS NULL ORDER BY created_at;"'
```

In the Neo4j browser, `MATCH (c:TransferClaim {state: 'SIGNING'}) RETURN
c.documentId, c.transferEventId, c.createdAt` lists reservations still held
for signing. Restore the failed dependency and let the existing workers retry;
inspect both databases and the signed object when intervention is needed.
These reservations do not expire and there is no automatic release for an
uncertain signature. Do not delete an operation, acknowledge a rejected event,
or release a claim merely because a request timed out: doing so can create
conflicting signed documents or incomplete audit records.

## Configuration

[`server/src/config.ts`](./server/src/config.ts) validates `PORT` (`8080`),
`NATS_URL` (`nats://localhost:4222`), `NODE_ENV` (`development`),
`S3_PUBLIC_ENDPOINT` (`http://localhost:9000`), `S3_REGION` (`us-east-1`), and
`DOCUMENT_BUCKET` (`dsap`); `S3_ACCESS_KEY` and `S3_SECRET_KEY` are required.
Set `S3_PUBLIC_ENDPOINT` to the exact browser-reachable S3 origin; rewriting a
URL after signing invalidates its signature.

## Frontend

The client exposes the federated widgets `DocumentsTable`,
`ComplianceWorkflowWidget`, and `TemplateSelector` (`compliance_client`); the
[compliance shell](../../../ui-shells/README.md) composes them with topology
selectors and the audit transfers table. While the signing workflow remains
open, it checks for application and refreshes receipt-page options when the
update is applied; the signed receipt remains visible until another selection
is made. Graph caches in the current browser session are invalidated on save
and application; this is not a cross-tab or cross-user live update.

## Local development

Compose services: `compliance-db` (PostgreSQL), `compliance-db-setup`,
`compliance-server`, and `compliance-client` (internal ports `8080`/`3000`). A
`compose.dev.yaml` override exists.

- Workspaces: `compliance-client`, `compliance-server`, `compliance-shared`.
- `pnpm --filter compliance-server test:unit` / `test:verify`;
  `pnpm --filter compliance-client test:unit` / `test:contract`. The isolated
  cross-service suites run through `pnpm test:integration` — see the
  [testing guide](../../../docs/development/testing.md).
