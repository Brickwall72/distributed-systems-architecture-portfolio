# System Security Plan (SSP): Zero Trust Architectural Controls

## Status
Accepted | **Date:** 2026-08-15 | **Author:** Sam Brickett

---

## 1. System Boundary and Boundary Isolation
The system boundary encompasses exactly 8 distributed service nodes and 1 messaging broker running inside an isolated local container mesh.
* **Access Control:** Direct external access to database engines is completely blocked. All external traffic must transit through the API Gateway / Ingress route.
* **Network Segmentation:** Inter-service network communication is micro-segmented. Platform utilities (like `pdf-generator`) operate under a strict zero-egress policy, blocking them from originating connections to internal core databases or the external internet.

## 2. Cryptographic Data Protection (At Rest and In Transit)
* **Data-In-Transit:** Every network interaction across the microservice cluster interface is encrypted via mutual TLS (mTLS) or HTTPS using standard TLS 1.3 protocol parameters.
* **Data-At-Rest:** The append-only database volume assigned to the `audit-ledger` uses block-level AES-256 encryption parameters to prevent raw disk tampering.

## 3. Cryptographic Authentication & Attestation
* **Token Authentication:** Core services verify identity transitively via cryptographically signed JSON Web Tokens (JWT) carried inside HTTP Authorization headers.
* **Broker Provenance:** Asynchronous events broadcast to the Message Broker Topic must contain a matching `publisherIdentity` and a valid `attestationSignature` to defeat message injection or spoofing threats.
