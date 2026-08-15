# ADR-004: HTTP Method Selection Criteria for Validation Processing vs. Volatile Telemetry Retrieval

## Status
Accepted

* **Date:** 2026-08-14
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
The process coordinator (`compliance-service`) interacts with two distinct external dependencies during its blocking validation gate check: the `topology-service` and the `resource-cache`. While both interactions return state verification results over the network interface, their underlying data structures, data sensitivity, and internal processing demands vary significantly. The platform requires a clear architectural standard for selecting HTTP methods (`POST` vs. `GET`) to ensure semantic correctness, prevent malicious data exposure in infrastructure logs, and eliminate system failure modes caused by network caching.

## Decision Drivers
* **Network Caching Prevention:** Safety-critical validation states must always be fetched fresh from the live data source; stale, cached responses will cause critical operational bypasses.
* **Information Security Boundaries:** Sensitive operational data, nested relational links, or complex operation context parameters must not leak into unencrypted proxy or router telemetry logs.
* **Semantic Conformity:** Network interaction methods must align with strict HTTP specification contracts regarding idempotency and side-effect safety.

## Decision
The system enforces a strict dichotomy between validation calculations and raw property fetches:

1. **Non-Idempotent `POST` for the `topology-service` (`/api/v1/topology/authorizations`):**
   Validation requests to the graph engine require evaluating complex relationships (source assets, target operations, and situational action contexts). This metadata is encapsulated strictly within the HTTP request body via `POST` to hide sensitive identifiers from query string logging. Furthermore, because executing a validation check triggers internal security audit logs and counters, it is treated as an active operation that carries side effects. Using a non-idempotent `POST` inherently blocks all intermediate proxies and runtimes from caching the response.

2. **Idempotent, Non-Cached `GET` for the `resource-cache` (`/api/v1/telemetry/:assetId`):**
   Retrieving the resource status requires only a single, non-sensitive identifier passed cleanly through the path parameter, presenting no data leakage risk. This operation is purely read-only and side-effect free, conforming strictly to the semantic definition of an HTTP `GET`. To mitigate the risk of standard browser or proxy caching, the cache service is configured to append explicit, mandatory Cache-Control response headers (`no-store`, `no-cache`, `must-revalidate`) to enforce real-time network freshness on every query.

## Consequences
* **Positive (Benefits):** Mitigates the risk of a grounded asset accidentally showing as cleared due to an intermediate caching layer. Protects high-value mission metadata from leaking into standard infrastructure access files. Proves a mature REST architecture by using the correct semantic protocol wrapper for the correct mechanical job.
* **Negative (Risks):** Utilizing a `POST` for a read-focused validation check slightly deviates from superficial CRUD conventions and increases the request payload serialization overhead relative to flat query parameters.

## Validation and Compliance Plan
* **Log Inspection Audits:** Integration test suites must verify that sensitive data parameters are never appended to URL paths during validation execution.
* **Cache Header Compliance Verification:** Automated unit test blocks must assert that every request targeting the `resource-cache` endpoint responds with explicit cache-breaking instructions to guarantee a zero-cache operational environment.
