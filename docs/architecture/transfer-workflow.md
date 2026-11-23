# Authorization and transfer workflow

How a custody transfer moves through the system, end to end. The
[architecture model](./model.json) describes the current service interactions;
the generated [interaction view](../generated/architecture/architecture.md)
shows the UI composition and communication types. Each service's README
documents its own responsibilities in detail.

## End-to-end flow

1. A user selects a demo profile. The auth service issues an identity whose
   organization and roles accompany requests to protected APIs. Each service
   applies its own access scope; the browser's selection is not an authorization
   decision. Platform auditors have global read access but cannot create or sign.
2. The topology API returns organizations and profile-scoped assets and graphs.
   The current custodian and the intended receiver of an in-transit asset can see
   its complete visual history. Transfer participants can access their own
   transfer documents without gaining access to unrelated documents.
3. Compliance asks topology over synchronous NATS request/reply to validate a
   draft and obtain authoritative organization and asset facts. Compliance uses
   those facts to generate a PDF via a synchronous PDF-service request and binds
   the draft to its creator, transfer details, and content hash.
4. On signing, compliance persists a signing operation and requests an atomic
   topology reservation over NATS. Authorizations and receipts both reserve
   their assets; exact retries reuse the same claim and transfer ID. Overlapping
   claims conflict. Reservations are not automatically expired when signing may
   have occurred.
5. Compliance requests a signature from e-sign, then transactionally records the
   signed result, document, participant data, and two event intents. The signed
   document can be returned before topology applies the transition. A durable
   outbox retries publication of the signed-transfer event for topology and the
   initiated/received document event for audit.
6. Topology validates the signed event against the reservation, atomically
   updates custody and transfer state, and records a topology result in its own
   outbox. Redelivery of an identical signed event is idempotent. Topology result
   events reconcile compliance's document status and provide snapshots to audit.
7. Audit joins independently delivered compliance and topology events. Completion
   identifies committed receipt documents, so sealing waits for the required
   documents and snapshots rather than assuming delivery order. Audit creates a
   sealed transfer record and requests a PDF overview from the PDF service.

The workflow and database twin show topology synchronization as pending,
applied, or attention required. A stalled update or publication failure is
visible for operator investigation; neither an uncertain signature nor a timeout
automatically releases a reservation. See the
[development guide](../development/) for startup, recovery, and security
limitations.

## Messaging and storage boundaries

Signed events require a matching topology reservation and commit through the
claims repository; compliance and topology publish through transactionally
recorded outboxes rather than direct publishers, and stream verification runs
at startup.

PDF generation and e-sign requests are synchronous NATS operations. E-sign
checks the draft hash, requires a valid signing certificate, and uses
conditional object creation to make exact retries converge on one stored signed
artifact. Storage uses a private bucket and issues time-limited signed URLs;
already issued URLs remain bearer capabilities until they expire. Storage
clients also support conditional creation used by retry recovery.

Shared contracts validate message and API boundaries. NATS uses separate
service credentials, scoped subjects and reply inboxes. Topology and compliance
create or verify their own streams, and each subscriber creates or verifies its
own durable consumers. Subscribers wait unready for missing upstream streams;
retained messages remain available to new consumers within stream retention
limits. Permissions include exact consumer management subjects where necessary
and do not validate every field in a management request. Compose and Kubernetes
configure the identities; local NATS transport is not encrypted. mTLS is a
separate future effort.
