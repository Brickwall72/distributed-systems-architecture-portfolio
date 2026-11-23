# Audit ledger

Maintains the tamper-evident transfer audit record. It consumes compliance
document facts and topology snapshots independently, accumulates them into
per-requisition drafts, seals completed transfers into an insert-only
hash-chained collection, and requests PDF overviews from the
[PDF generator](../../platform/pdf-generator/README.md).

## Responsibilities and data flow

- Serves participant- and auditor-scoped transfer reads over HTTP under
  `/api/v1` (`GET /api/v1/transfers`,
  `GET /api/v1/transfers/:requisitionNumber/document`; health at
  `GET /api/v1/health`, liveness at `GET /live`).
- Runs one durable JetStream consumer per subscribed subject. Events are
  validated at the entry point; malformed events go to `dead_letters` as
  `MALFORMED` and are acked (a retry can never succeed), while service
  failures are naked and redelivered.
- Seals a transfer only when the required signals are present: the signed
  authorization document, topology completion, and — for physical transfers —
  receipt documents covering every asset. Completion identifies committed
  receipt documents, so sealing never depends on delivery order.
- The rendition worker retries generation of the audit overview PDF; rendition
  readiness is separate from ledger sealing. Rendition objects live under the
  `dsap` bucket prefix `audit/transfers/`.

## Data store

MongoDB database `audit` with repositories for `events` (append-only raw event
log), `transfer_drafts`, `sealed_transfers`, `dead_letters`, and renditions.
Setup provisions indexes, including immutability-supporting unique indexes for
events, sealed transfers, and dead letters. The application account can read
and insert ledger events, sealed transfers and dead letters, but cannot update
or delete them; drafts and rendition state remain mutable. This protects
against application-account tampering, not against administrators or false
inserts.

## Event flow and sealing walkthrough

The walkthrough below follows the code in `consumer.ts`, `ledger.service.ts`,
`drafts.repository.ts` and `seal-signals.ts`.

The example is a physical transfer of assets A and B, with REQ-1 as the
requisition number. There is one authorization, receipt R1 covering A, and
receipt R2 covering B. The order below is typical, but the ledger doesn't
depend on it.

### What happens on every event

Every event takes the same path, whichever subject it arrives on.

1. **Consumer.** One durable JetStream consumer per subject receives the
   CloudEvent. `safeParse` runs against the ledger's entry-point schema, which
   turns the CloudEvent into `{meta, data}` and validates it locally.
   - If the event is malformed, it goes to the `dead_letters` collection as
     `MALFORMED` and is acked, because a retry can never succeed.
   - Otherwise it calls `ledgerService.handle…`, and `ack()` happens only after
     that returns.
   - If the service throws, for example because Mongo is down, the broker naks
     and redelivers after 5 seconds.
2. **`accumulate()`** runs three steps in order.
   - **`drafts.apply`** does one upsert on `transfer_drafts`, filtered on
     `{requisitionNumber, status ≠ SEALED}`. It sets the event's fields, adds
     the event id to `eventIds` with `$addToSet`, and on first insert sets
     `status: OPEN` and `createdAt`. A replay changes nothing. If the draft is
     already sealed, no document matches and the outcome is `ALREADY_SEALED`.
   - **`events.append`** writes the raw event to the `events` collection as an
     append-only log.
   - **`trySeal`** reloads the draft and calls `getMissingSignals`. If any
     signal is missing, it logs that the transfer remains open and stops.

### The sequence for REQ-1

| # | Event | Draft change | Missing signals afterward |
|---|---|---|---|
| 1 | Compliance `transfer.initiated` (authorization signed) | The draft is created. `authorization` holds the document facts, with `requisitionNumber` split off. | `TOPOLOGY_COMPLETED`, `RECEIPT_DOCUMENTS`. `transferType` is not yet known, so the receipt check is skipped for now. |
| 2 | Topology `transfer.created` | `transferEventId`, `transferType: PHYSICAL`, `date`, `sender`, `receiver` and `assets [A, B]` are set. | `TOPOLOGY_COMPLETED`, `RECEIPT_DOCUMENTS` |
| 3 | Compliance `transfer.received` for R1 | `receiptDocuments.R1 = {assetIds:[A], signer, hash…}` | `TOPOLOGY_COMPLETED`, `RECEIPT_DOCUMENTS`. Receipted assets are {A}, which doesn't cover B. |
| 4 | Topology `transfer.updated` for R1 | `receivedAssets.R1 = [A…]` (topology's view of what arrived) | Same as row 3 |
| 5 | Compliance `transfer.received` for R2 | `receiptDocuments.R2 = {assetIds:[B]…}` | `TOPOLOGY_COMPLETED` only. Receipted assets are now {A, B}, so every asset is covered. |
| 6 | Topology `transfer.updated` for R2 | `receivedAssets.R2 = […]` | `TOPOLOGY_COMPLETED` |
| 7 | Topology `transfer.completed` | The creation fields are re-set with the same values. `topologyCompleted: true`, `completedAt` and `receivedAssets.R2` are set. | None |

Receipts are stored in maps keyed by document id (`receiptDocuments.R1`,
`receiptDocuments.R2`), so each receipt is its own `$set` path. Two receipts
arriving at nearly the same time can't overwrite each other.

`transfer.completed` carries everything `created` and `updated` carry. This is
why it can populate a draft by itself for C2 transfers, which may publish
nothing else.

### Sealing at step 7

With no missing signals, `trySeal` does the following in a retry loop of up to
5 attempts.

1. It calls `sealed.findLast()` to get the previous record.
2. It maps the draft to a sealed record using `sequence = last.sequence + 1`
   and `prevHash = last.recordHash`. For the very first record, `prevHash` is
   64 zeros.
3. It computes `recordHash = sha256(canonicalJson(record without recordHash))`.
4. It calls `sealed.insert(record)` into `sealed_transfers`. This collection is
   insert-only, and `sequence` and `requisitionNumber` are unique.
5. It calls `drafts.markSealed`, which sets `status: SEALED`.
6. If the insert hits a duplicate key error, another writer either sealed this
   requisition or took the sequence number.
   - If the requisition is already sealed, the draft is marked sealed and the
     call returns.
   - Otherwise it retries with a fresh sequence number.

If the process crashes between step 4 and step 5, the broker redelivers the
event. `apply` is idempotent, and the duplicate on `requisitionNumber` leads to
the "already sealed" branch, which marks the draft sealed.

### Order variations

- **`completed` arrives before R2's `received`.** At step 7 the missing signal
  is `RECEIPT_DOCUMENTS`, so the draft stays OPEN. When R2's `received`
  arrives, `trySeal` runs again and seals. The same happens if the
  authorization is the last event to arrive, for example a weeks-late
  `initiated`. Whichever event completes the set triggers the seal.
- **Any event after the seal.** `apply` returns `ALREADY_SEALED`. The event is
  still logged in `events`, and a `LATE_EVENT` entry is added to
  `dead_letters`. The sealed record is not touched.
- **C2 transfer.** Signal 3 (`RECEIPT_DOCUMENTS`) is not required, so topology
  `completed` plus the authorization is enough to seal.

## Configuration

[`server/src/config.ts`](./server/src/config.ts) validates `PORT` (`8080`),
`NATS_URL` (`nats://localhost:4222`), `NODE_ENV` (`development`), `DB_HOST`
(`audit-db`), `DB_PORT` (`27017`), `DB_NAME` (`audit`), `DB_AUTH_SOURCE`
(`admin`), the immutable-index flag (default `false`), and the S3 endpoint
settings (`http://localhost:9000`, region `us-east-1`); S3 keys are required.

## Frontend

The client exposes the federated `TransfersTable` widget (`audit_client`),
composed into the compliance shell's review pages. Reads are restricted to
transfer participants or platform auditors.

## Local development

Compose services: `audit-db` (MongoDB), `audit-db-setup`, `audit-server`, and
`audit-client` (internal ports `8080`/`3000`). A `compose.dev.yaml` override
exists.

- Workspaces: `audit-client`, `audit-server`, `audit-shared`.
- `pnpm --filter audit-server test:unit` / `test:verify`;
  `pnpm --filter audit-client test:unit` / `test:contract`. The isolated
  cross-service and MongoDB authorization suites run through
  `pnpm test:integration` — see the
  [testing guide](../../../docs/development/testing.md).
