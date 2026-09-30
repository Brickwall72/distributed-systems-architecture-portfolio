# Interface Control Document (ICD): Distributed Mission Operations Baseline

## 1. Document Control & Purpose
* **System Baseline:** Version 1.4.1 (NATS JetStream & Asynchronous Document Lifecycle Alignment)
* **Status:** Active Configuration
* **Description:** Master interface contract between core nodes, platform utilities, and micro-frontend shells. Freezes network paths, schema contracts, CloudEvent specifications, and error schemas. Frontend remote discovery is managed via a Hub-and-Spoke runtime registry utilizing `mf-manifest.json` streams, while document persistence state settlement is handled via asynchronous NATS JetStream event lines. Schema compliance is enforced at runtime boundaries via Zod and verified via Consumer-Driven Contract (Pact V3) tests.

---

## 2. Global Network & Observability Parameters
* **Primary Ingress Gateways:**
  - **Decentralized Local Dev (Compose):** `http://localhost` (Traefik reverse proxy)
  - **Integrated Kubernetes (k3d):** `http://localhost:8081` (Traefik ingress controller)
  - *Note: Runtime port delta avoids local host socket collisions during simultaneous container and cluster testing.*
* **Ingress Domain Prefix Routing:** 
  - Subsystem codebases remain domain-agnostic and listen on standard root endpoints (`/api/v1/*`).
  - Traefik edge proxies intercept external traffic, evaluate structural domain prefixes (`/topology`, `/compliance`, `/pdf`, `/esign`), and strip path prefixes before forwarding traffic to backend workloads.
* **Primary Protocol:** Synchronous stateless communication occurs via HTTP/1.1 with `application/json` payloads unless streaming raw binary files.
* **Traceability Requirement (Correlation ID):** Every transaction must carry a unique `X-Correlation-ID` header (`UUIDv4` or `cid_<uuid>`). This header is propagated transitively by coordinators through downstream HTTP queries and attached to NATS JetStream CloudEvent envelopes and log contexts.

---

## 3. Path-Routed HTTP API Contracts (Core Gate & Utilities)

### 3.1. UI Application Registry Contracts (`/registry/apps.json`)
Exposes active platform layout remotes to host applications on boot.

* **Response Schema (200 OK):**
  ```json
  {
    "remotes": [
      {
        "type": "esm",
        "name": "topology_shell",
        "entry": "http://localhost:8081/topology-shell/mf-manifest.json"
      },
      {
        "type": "esm",
        "name": "compliance_shell",
        "entry": "http://localhost:8081/compliance-shell/mf-manifest.json"
      }
    ]
  }
  ```

### 3.2. Topology Service Proxy (`/topology`) -> `topology-server`
Provides graph relationship checks, asset custody projections, and structural authorization gate verification.

* **Exposed Gateway Paths:**
  1. `GET /topology/api/v1/organizations`
  2. `GET /topology/api/v1/assets` (Query parameters: `?ownerId=string&excludeOwnerId=string`)
  4. `GET /topology/api/v1/entities`

### 3.3. Platform PDF Generator Proxy (`/pdf`)
Stateless platform utility processing structured compliance data payloads (e.g., DD-1149 templates) into raw PDF binary streams.

* **Exposed Gateway Paths:**
  1. `POST /pdf/api/v1/generate`

### 3.4. E-Signature Service Proxy (`/esign`) -> `esign-server`
Handles document signature compilation, PKCS#12 identity certificate sealing, object storage persistence, and event dispatch.

* **Exposed Gateway Paths:**
  1. `POST /esign/api/v1` – Submits a document for cryptographic sealing and object store dispatch.

### 3.5. Compliance Document Ledger Proxy (`/compliance`) -> `compliance-server`
Handles database metadata persistence logging and audit ledger retrieval.

* **Exposed Gateway Paths:**
  1. `POST /compliance/api/v1/documents` – Adds metadata history records to PostgreSQL.
  2. `GET /compliance/api/v1/documents` – Queries metadata records from PostgreSQL.
  3. `GET /compliance/api/v1/documents/:id` – Retrieves metadata record by document ID.

---

## 4. Asynchronous Event Channel Specifications (NATS JetStream Broker Mesh)

### 4.1. Stream Definition & Routing
* **JetStream Stream Name:** `ESIGN_EVENTS`
* **Subject Wildcard:** `events.esign.>`
* **Durable Consumer:** `compliance-server-document-signed-consumer`
* **Acknowledgment Policy:** Explicit (`AckPolicy.Explicit`) with backoff redelivery on `nak()`.

### 4.2. Event Subject: `events.esign.compliance.document.signed`
* **Trigger Event:** Fired by `esign-server` following PKCS#12 certificate sealing and S3 (`minio`) upload confirmation.
* **Consumer Subscriber:** `compliance-server` durable consumer intercepts the message, validates the CloudEvent schema, populates `compliance-db`, and issues an explicit `ack()`.
* **Event Type:** `com.system.esign.document.signed`
* **Message Payload Schema (CloudEvent 1.0 Specification):**
  ```json
  {
    "specversion": "1.0",
    "id": "evt_c1a3b53f-7e82-4122-8921-2a6d1487b219",
    "source": "service:esign-server",
    "type": "com.system.esign.document.signed",
    "time": "2026-09-30T04:00:00.000Z",
    "datacontenttype": "application/json",
    "correlationId": "cid_f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "data": {
      "documentId": "123e4567-e89b-12d3-a456-426614174000",
      "documentType": "DD-1149",
      "signerId": "usr_alpha_99",
      "entityId": "ent_mil_01",
      "status": "SIGNED",
      "signedAt": "2026-09-30T04:00:00.000Z",
      "uploadedAt": "2026-09-30T04:00:01.000Z",
      "s3Uri": "s3://compliance-documents/DD-1149/123e4567-e89b-12d3-a456-426614174000.pdf",
      "storageBucket": "compliance-documents",
      "storageKey": "DD-1149/123e4567-e89b-12d3-a456-426614174000.pdf",
      "fileHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
  ```

---

## 5. Standard System Network Error States
Every service operating within the cluster network interface must respond with a uniform schema when an error gate is triggered:

```json
{
  "errorCode": "SCHEMA_VALIDATION_FAILURE",
  "message": "Payload failed Zod ingress gate validation.",
  "correlationId": "cid_f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-09-30T04:00:00.000Z"
}
```