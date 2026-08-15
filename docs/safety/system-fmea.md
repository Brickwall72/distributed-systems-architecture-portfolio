# Failure Mode and Effects Analysis (FMEA): Distributed Platform Baseline

## 1. Risk Evaluation Scoring Criteria
* **Severity (S):** 1 (No operational impact) to 10 (Total mission failure / data corruption).
* **Occurrence (O):** 1 (Highly improbable) to 10 (Frequent, predictable failure).
* **Detection (D):** 1 (Instantly caught via automated health gates) to 10 (Invisible/undetected fault).

---

## 2. Baseline Risk Matrix

| Subsystem Component | Potential Failure Mode | Potential Effect of Failure | S | O | D | Initial RPN | Planned Architectural Mitigation | Revised S | Revised O | Revised D | Revised RPN |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ui-shell`** | Global JavaScript runtime exception crash in browser heap | Total loss of system control interface; operator cannot view telemetry or issue clearance. | 10 | 3 | 2 | **60** | Implement strict React/Framework Error Boundaries to isolate sub-widget crashes and allow graceful degradation. | 10 | 1 | 2 | **20** |
| **`compliance-service`** | Parallel HTTP gate timeout from dependent service | Process coordinator freezes blocking the workflow gateway indefinitely. | 7 | 4 | 3 | **84** | Implement a strict `Promise.race` timeout wrapper (2000ms limit) to force-abort failed gates. | 7 | 2 | 2 | **28** |
| **`topology-service`** | Graph NoSQL database driver connection pool exhaustion | Authentication checks drop under concurrent load, blocking clearance commands. | 8 | 4 | 4 | **128** | Enforce database connection pooling limits and automatic query retry-backoff configurations. | 8 | 2 | 2 | **32** |
| **`resource-cache`** | Stale telemetry properties persist past expiration | Operator visualizes outdated battery/fuel metrics, risking critical deployment bypass. | 9 | 3 | 5 | **135** | Implement absolute Redis TTL (Time-To-Live) constraints + Cache-Control header rules forcing cache invalidation. | 9 | 1 | 2 | **18** |
| **`audit-ledger`** | Append-only database disk write-lock saturation | Asynchronous event settlement messages stall in the queue, delaying transaction finalization. | 8 | 3 | 4 | **96** | Separate storage volumes; allocate high-I/O dedicated virtual drives for the write-heavy ledger container. | 8 | 1 | 2 | **16** |
| **`platform/pdf-generator`** | Memory heap exhaustion via unverified HTML string size | Utility container crashes mid-stream execution, breaking document delivery channels. | 5 | 5 | 2 | **50** | Apply strict incoming body-size request validation middleware (max 5MB limit) to drop bloated payloads. | 5 | 2 | 2 | **20** |
| **`platform/pdf-viewer`** | Stream-rendering failure / empty canvas rendering | Visual component shows blank artifact, breaking the What-You-See-Is-What-You-Sign constraint. | 9 | 4 | 3 | **108** | Implement programmatic visual token verification on frontend canvas mount; disable the signature button if the stream fails to render. | 9 | 2 | 2 | **36** |
| **`platform/esign-service`** | Cryptographic key manager service connection failure | Documents cannot receive digital authorization signatures, stranding transactions. | 8 | 3 | 4 | **96** | Configure a highly available local fallback key cache with strict cryptographic rotation boundaries. | 8 | 1 | 2 | **16** |
| **`message-broker`** | Broker node disk space fills up completely | Pub/Sub topic rejects inbound transactions, causing immediate event dropouts. | 9 | 2 | 5 | **90** | Configure a strict message compaction policy and automated truncation logs on the event broker engine. | 9 | 1 | 2 | **18** |
