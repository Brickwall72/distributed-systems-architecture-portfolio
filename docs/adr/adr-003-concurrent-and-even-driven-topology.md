# ADR-003: Core Validation Latency Optimization via Concurrent Blocking HTTP Verification and Event-Driven Pub/Sub Topology

## Status
Accepted

* **Date:** 2026-08-14
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
The system core must execute a rigorous gate check before authorizing document compilation. It must validate system relationships against the `topology-service` and verify resource capacity via the `resource-cache`. While high-performance protocols like gRPC were considered to minimize transmission overhead, implementing gRPC introduces significant complexity overhead (e.g., managing `.proto` contracts, compiling stubs, and configuring HTTP/2 multiplexing) that is counterproductive to rapid MVP velocity. 

Furthermore, running these network queries in a sequential blocking chain compounds latency. The system cannot proceed to document generation or signature execution unless both conditions are verified as successful; a failure or unauthorized state in either dependency must immediately abort the workflow. Post-signature transaction settlement via traditional synchronous HTTP requests also introduces data-loss risks if network paths fail mid-operation.

## Decision Drivers
* **Strict Gate Enforcement:** Document generation and signature execution must be strictly blocked until both structural authority and physical asset readiness are completely verified.
* **Complexity Overhead Minimization:** Avoid high-friction protocols like gRPC during the initial baseline implementation to maximize development velocity.
* **Operational Latency Reduction:** Minimize blocking gate latency over the network by avoiding sequential network bottlenecks.
* **Data Settlement Resilience:** Post-signature flight clearance artifacts and system state transitions must safely survive local network dropouts or database crashes.

## Decision
The architecture employs a dual-mode, hybrid network topology:
1. **Concurrent Blocking HTTP/REST Validation Gate:** The process coordinator triggers background network checks to the `topology-service` and `resource-cache` concurrently via standard HTTP/REST requests using non-blocking I/O. However, the workflow halts and blocks synchronously at this gate, waiting for both responses to resolve. The pipeline only proceeds to the PDF rendering step if both HTTP services return explicit, successful validation parameters. If either check fails or times out, the transaction is immediately terminated.
2. **Asynchronous Event-Driven Settlement:** Upon successful signature execution, state synchronization bypasses synchronous HTTP lines. The coordinator publishes a single `FlightClearanceFinalized` event to an asynchronous Message Broker Topic. Downstream consumer nodes (`audit-ledger` and `resource-cache`) listen to this topic independently via a Publish/Subscribe pattern.

## Consequences
* **Positive (Benefits):** Reduces blocking gate latency to `Max(Topology, Cache)` rather than the sum of both, without sacrificing system safety. Eliminating gRPC maintains high MVP velocity by using standard, highly testable JSON-over-HTTP payloads. The event broker ensures eventual consistency for post-signature logging, guaranteeing a 100% reliable "black box" audit trail.
* **Negative (Risks):** Standard HTTP/REST introduces slightly larger text payload serialization overhead compared to binary gRPC streams. The infrastructure mesh requires an added event broker dependency, and the system core must tolerate minor intervals of eventual consistency while post-signature events propagate.

## Validation and Compliance Plan
* **Blocking Guard Testing:** Testing suites must simulate failure responses (e.g., HTTP 400 or 403) from either the `topology-service` or `resource-cache` to verify that the compliance coordinator strictly terminates the pipeline and never invokes the `pdf-generator` utility.
* **Event Retention Validation:** Simulation scripts must verify that dropping the `audit-ledger` container node mid-transaction results in successful event consumption and recovery once the service returns to an active state.
