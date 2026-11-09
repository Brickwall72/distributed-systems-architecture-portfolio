# ADR-015: Immutable Audit Ledger via Event Accumulation and Hash-Chained Sealing

## Status
Amended (2026-11-08) — Added in a renditions collection for handling the generation and storage of pdf documents for sealed transfer records.

* **Date:** 2026-10-05
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
A completed transfer spans documents owned by `compliance-server` and organization/asset state owned by `topology-server`. A physical transfer may have several receipt events covering different asset subsets, possibly weeks after authorization; a C2 transfer has no receipt at all. The platform needs one immutable, tamper-evident record per completed transfer.

## Decision Drivers
* **Point-in-time truth:** The record must show what was true when the transfer happened, not current state.
* **Temporal decoupling:** Services must not need to be online simultaneously, and receipts may arrive long after authorization.
* **Variable shape:** Receipts vary in number per transfer.
* **Tamper evidence:** Alterations must be detectable.

## Options Considered

### Option 1: Query-back on `transfer.completed`
* **Cons:** Returns current rather than historical state; couples the ledger to the availability of every source service at completion time.

### Option 2: Rely on broker persistence alone
* **Cons:** Stream retention is not a system of record; weeks-long gaps make retention a hidden dependency.

### Option 3: Event-carried state accumulated into the ledger's own MongoDB (Selected)
* **Pros:** Each event carries the snapshots it needs; the ledger keeps its own durable draft per requisition; no synchronous coupling; document model fits variable receipts.
* **Cons:** Requires fatter events and idempotent, order-independent merging.

## Decision
`audit-server` subscribes to topology and compliance events with durable consumers, merges them into an `OPEN` draft keyed by `requisitionNumber`, and seals the draft into an insert-only record when every required signal is present.

* **Collections:** `events` (insert-only log, unique `eventId`), `drafts` (mutable accumulation), `sealed_transfers` (insert-only, unique `sequence` and `requisitionNumber`), `dead_letters`.
* **Idempotent, order-independent merge:** Writes are `$set` of fixed paths plus `$addToSet` of the event id; receipts are maps keyed by `documentId`. The draft write precedes the event-log insert so a crash followed by redelivery re-applies safely.
* **Seal gate (`requiredSignals`):** topology completed, authorization document present, and — for physical transfers only — receipt documents covering every asset. Receipt completeness is derived from asset ids rather than a declared expected count. A future compliance "completed" event would be one more required signal.
* **Hash chain:** `recordHash = sha256(canonical JSON of the record without recordHash)`; `prevHash` links to the preceding record (64 zeros for the first). Verification endpoints recompute hashes, links, and sequence continuity.
* **Late events:** Events after sealing are logged and dead-lettered as `LATE_EVENT`; a sealed record is never mutated.
* **Malformed events:** Dead-lettered and acked. Operational failures `nak()` with a delay and no delivery cap.
* **Document facts, not locations:** Document id, name, type, content hash, signer, and signing time are recorded; storage paths are excluded because they can change and `documentId` resolves them.
* **Transfer overview renditions:** `transfer_renditions` separately tracks a versioned PDF for each sealed sequence, including the source hash, state, retry/lease and storage metadata. A periodic keyset reconciliation discovers historical and missed records; sealing nudges the worker without waiting for PDF generation. Workers use fenced leases and attempt-specific object keys so a late PDF upload cannot overwrite a winning attempt. Failed jobs retry with capped backoff. Unreferenced objects from failed or expired attempts require a future safe garbage-collection process.
* **Retrieval:** Sealed summaries expose `PENDING`, `GENERATING`, `FAILED` or `READY`. `GET /transfers/:requisitionNumber/document` returns a fresh URL only for a ready rendition (404 for an unknown seal, 409 while unavailable), with `Cache-Control: no-store`. The browser caches the downloaded blob per profile and transfer, not the temporary URL. The PDF hash is mutable rendition metadata, not part of the sealed hash chain; verify the sealed record separately.
* **Validation:** ADR-014 conventions apply: entry-point schemas split the CloudEvent into metadata and data, and twin-tier wire/local schemas are checked by zocker contract-boundary tests.

## Consequences
* The ledger is self-contained and survives source-service downtime or data changes.
* Open drafts are visible with their `missingSignals`, making stalled transfers diagnosable.
* Immutability is enforced at the repository layer (no update/delete on sealed records) and made tamper-evident by the chain; database-level role restrictions (insert/find only on sealed collections) are a recommended hardening step, since local deployments connect with the provisioned root user.
* Audit-server needs `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` for browser-facing presigning. The endpoint must exactly match the browser-reachable signing origin, and MinIO CORS must allow the shell origin; use HTTPS for remote deployments. Compose and Helm follow the existing compliance-service settings and MinIO secret.
* JWT authentication does not enforce organization authorization, and the local Compose bucket is public. Presigned URLs are bearer credentials and the existing PDF NATS response includes one. This demo must use fictional data until private storage and per-organization authorization are implemented.
