# ADR-003: Core Validation Latency Optimization via Synchronous HTTP Verification and Asynchronous NATS JetStream Event Pipeline

## Status
Amended (2026-09-30) — Updated to eliminate phantom `resource-cache` service dependency (YAGNI), focusing the blocking pre-signature verification gate exclusively on `topology-server`. Retains NATS JetStream stream topologies (`ESIGN_EVENTS`), CloudEvent 1.0 specifications, Claim-Check storage semantics, and zero-trust NetworkPolicy boundaries.

* **Date:** 2026-08-14
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
The platform core requires a strict gate check prior to authorizing PDF document rendering and cryptographic signature execution. System structural relationships and authority state must be validated against `topology-server`.

Post-signature transaction settlement via traditional synchronous HTTP REST calls introduces tight coupling, latency spikes, and potential data loss if downstream databases or services experience transient outages. Passing raw binary PDF payloads over synchronous HTTP or message broker topics introduces network bloat, memory exhaustion, and scatters cryptographic boundary cohesion across intermediate services.

## Decision Drivers
* **Strict Gate Enforcement:** Document generation and cryptographic execution must be strictly blocked until structural authority is confirmed via `topology-server`.
* **Latency Minimization:** Bound pre-signature network validation latency strictly to the single round-trip time of `topology-server` ($T_{\text{topology}}$).
* **Cryptographic Boundary Cohesion:** Keep PKCS#12 identity certificate (`certificate.p12`) operations, PDF signing, and S3 object persistence isolated within a single utility service (`esign-server`).
* **Guaranteed At-Least-Once Delivery:** Ensure downstream audit ledger synchronization (`compliance-server` / `compliance-db`) is resilient to transient failures without blocking client threads.
* **Network & Payload Efficiency:** Avoid passing large binary assets across the event broker by separating event notifications from binary data storage.
* **Zero-Trust Security:** Enforce strict Layer 3/4 network micro-segmentation across all service, database, and broker communications.

---

## Options Considered

### Option 1: Fully Synchronous HTTP Chain with Direct Binary Payload Transfers
* **Pros:** Simple to implement; no message broker infrastructure required.
* **Cons:** High request latency; single point of failure; risk of partial transaction completion; passing binary streams over HTTP bloats intermediate memory buffers.

### Option 2: Synchronous Validation Gate + Asynchronous NATS Core Pub/Sub (Standard Topics)
* **Pros:** Decouples post-signature processing from client responses.
* **Cons:** Lacks persistent delivery guarantees; if `compliance-server` is offline during publication, events are permanently lost.

### Option 3: Single-Hop HTTP Validation Gate + Asynchronous NATS JetStream Event Pipeline with Claim-Check Pattern (Selected)
* **Pros:** Binds pre-signature latency strictly to $T_{\text{topology}}$; guarantees persistent event delivery with at-least-once durable consumer semantics; isolates binary payload storage to S3 (`minio`) using light Claim-Check references; maintains zero-trust isolation without phantom service dependencies.
* **Cons:** Introduces event broker infrastructure state management and requires consumers to implement idempotent processing.

---

## Decision
The architecture adopts a pattern combining a blocking HTTP validation gate against `topology-server`, localized cryptographic execution, S3 object persistence via the Claim-Check pattern, and asynchronous state settlement over NATS JetStream.

```
+-----------------------------------------------------------------------------------+
|                               PRE-SIGNATURE GATE                                  |
|                                                                                   |
|  Client Request ---> [ topology-server ] ---> Gate Pass? (Latency: T_topology)    |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
|                        CRYPTOGRAPHIC EXECUTION & PERSISTENCE                      |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | esign-server                                                                |  |
|  |  1. Render PDF & Apply PKCS#12 Cryptographic Seal                           |  |
|  |  2. Write Binary Stream Direct to MinIO (s3://compliance-documents/...)      |  |
|  |  3. Construct CloudEvent 1.0 (Claim-Check: s3Uri, fileHash)                 |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
|                        ASYNCHRONOUS SETTLEMENT (NATS JETSTREAM)                   |
|                                                                                   |
|  esign-server ----(Publish: events.esign.compliance.document.signed)----> [NATS]  |
|                                                                             |     |
|  [Stream: ESIGN_EVENTS (events.esign.>)]                                    |     |
|                                                                             |     |
|  compliance-server <---(Durable: compliance-server-document-signed-consumer)-+     |
|   1. Validate Ingress Schema (DocumentSignedEventSchema)                          |
|   2. Persist Audit Record to PostgreSQL (compliance-db)                           |
|   3. Explicit ACK to JetStream (or NAK on failure)                                |
+-----------------------------------------------------------------------------------+
```

### 1. Blocking HTTP/REST Validation Gate
Before initiating document compilation, `esign-server` issues a non-blocking HTTP GET request to `topology-server` to evaluate structural authority and routing validity. Execution proceeds if and only if `topology-server` returns an HTTP 200 OK status code along with a valid authorization payload. Pre-execution network latency is bounded strictly by $T_{\text{topology}}$.

### 2. Consolidated Cryptographic Execution & S3 Claim-Check Storage
`esign-server` executes the entire cryptographic lifecycle locally:
* Signs the compiled document using a mounted PKCS#12 identity certificate (`certificate.p12`).
* Writes the resulting binary PDF directly to object storage (`minio` on port `9000/TCP`).
* Employs the **Claim-Check Pattern**: Instead of attaching raw binary buffers to event messages, `esign-server` constructs a lightweight CloudEvent 1.0 payload containing metadata, cryptographic hashes (`fileHash`), and storage references (`s3Uri`, `storageBucket`, `storageKey`).

### 3. Asynchronous Event-Driven Settlement via NATS JetStream
State synchronization completely bypasses synchronous HTTP REST boundaries:
* **Stream Topology:** NATS JetStream provisions an authoritative stream named `ESIGN_EVENTS`, capturing the wildcard subject pattern `events.esign.>`.
* **Event Publishing:** Upon S3 upload confirmation, `esign-server` publishes a `com.system.esign.document.signed` event to subject `events.esign.compliance.document.signed`.
* **Durable Consumption & Explicit Acknowledgments:** `compliance-server` registers a JetStream Durable Consumer (`compliance-server-document-signed-consumer`) configured with explicit acknowledgment (`AckPolicy.Explicit`).
* **Fault-Tolerant Delivery:** `compliance-server` emits an explicit `ack()` to JetStream only after writing the transaction record to `compliance-db`. If processing fails or an exception occurs during database execution, the consumer triggers an explicit `nak()`, instructing JetStream to schedule backoff redelivery.

### 4. Contract Schema Enforcement & CloudEvent 1.0 Specification
All event payloads adhere strictly to the CloudEvent 1.0 specification and undergo runtime validation using Zod schemas at both publisher egress (`esign-server`) and consumer ingress (`compliance-server`):
* **Event Types:** `com.system.esign.document.signed` and `com.system.esign.document.rejected`.
* **Envelope Metadata:** Includes standard `specversion`, `id`, `source`, `type`, `time`, `datacontenttype`, and `correlationId` tracking attributes.
* **Payload Validation:** Strict validation ensures timestamps conform to ISO 8601 UTC and mandatory identifiers (UUIDs, entity IDs, status flags) are validated prior to message dispatch or database execution.

### 5. Zero-Trust Network Micro-Segmentation
All internal network pathways are governed by strict Layer 3/4 `NetworkPolicy` manifests under a default-deny posture:
* **Storage Ingress/Egress:** `esign-server` is explicitly granted egress (`9000/TCP`) to `minio`, and `minio` permits ingress exclusively from authorized pod selectors (`esign-server`, `compliance-server`, `minio-setup`).
* **Broker Ingress/Egress:** `esign-server` and `compliance-server` are granted explicit egress (`4222/TCP`) to `nats`, and `nats` enforces ingress policies allowing only designated application workloads.

---

## Consequences

### Positive (Benefits)
* **Reduced Architectural Overhead:** Eliminates phantom service stubs, extra DNS lookups, and unneeded network policy configurations for non-existent workloads.
* **Optimized Execution Latency:** Binds validation gate latency strictly to $T_{\text{topology}}$ and eliminates post-signature HTTP round-trips from the user-facing request path.
* **Fault Isolation & Resilience:** Downstream outages in `compliance-server` or `compliance-db` do not impact document signing operations; NATS JetStream buffers unacknowledged events on disk until consumer recovery.
* **Bandwidth & Memory Efficiency:** Employs the Claim-Check pattern to keep broker event payloads under a few kilobytes, preventing memory bloat and preserving network throughput.

### Negative (Risks & Trade-offs)
* **At-Least-Once Delivery Complexity:** JetStream redelivery mechanisms require downstream consumers (`compliance-server`) to implement idempotent database write operations (e.g., `ON CONFLICT DO NOTHING` on primary keys) to handle re-delivered messages safely.
* **Infrastructure State Management:** Requires operational monitoring of JetStream stream limits, message retention policies, durable consumer state, and disk allocation.

---

## Validation and Compliance Plan

* **Failure Mode Verification:** Automated integration tests simulate failure scenarios (HTTP 400, 403, 500) from `topology-server` to verify that execution halts immediately prior to invoking PDF rendering or signing.
* **Bi-Directional Contract Verification (Pact V3):**
  * **HTTP Contracts:** Enforce schema shapes and status codes for pre-signature verification APIs against `topology-server`.
  * **Asynchronous Message Contracts:** Pact V3 async contract tests validate CloudEvent envelope structure, headers, correlation IDs, and payload Zod schemas between `esign-server` publishers and `compliance-server` consumers during CI builds without requiring live broker deployment.
* **Network Policy Auditing:** CI/CD pipeline checks verify that all Kubernetes manifests include explicit `NetworkPolicy` ingress/egress rules for port `4222/TCP` (NATS) and port `9000/TCP` (MinIO), ensuring no workload runs unsegmented under `default-deny`.