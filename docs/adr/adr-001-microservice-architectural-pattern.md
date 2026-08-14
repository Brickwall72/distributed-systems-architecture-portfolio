# ADR-001: Adoption of Microservice Architectural Pattern for Subsystem Fault Isolation

## Status
Accepted

* **Date:** 2026-08-14
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
The platform requires orchestrating a sequence of complex operations, including configuration management, telemetry caching, stateless document generation, and immutable transaction settlement. Implementing this as a unified, monolithic codebase creates a highly coupled system where a runtime exception or memory leak inside a single domain (such as an unverified, open-source library wrapper in the document rendering tier) could cascade and compromise critical operational nodes like the ledger or configuration engine.

## Decision Drivers
* **Fault Isolation:** High-risk third-party library executions must be sandboxed from mission-critical state tracking.
* **Independent Lifecycle:** Platform utility tools must remain stateless and reusable across distinct domain modules.
* **Maintainable Complexity:** Individual service codebases must remain small and decoupled to ensure rapid local workspace iteration.

## Decision
The monolithic design is rejected in favor of a distributed, microservice-based architecture. 
* The system is split into independent, single-purpose network nodes operating inside containerized environments.
* Each core domain microservice maintains complete database-per-service isolation, ensuring zero cross-domain storage pollution over the shared cluster network.

## Consequences
* **Positive (Benefits):** Achieves strict fault isolation. If a platform service (e.g., `pdf-generator`) experiences a runtime failure, it can crash and restart independently without interrupting or corrupting the live parallel verification loops or the main application state.
* **Negative (Risks):** Introduces significant network latency, complex cross-service serialization costs, and a much higher deployment and infrastructure management overhead compared to a standard monolith.

## Validation and Compliance Plan
* **Data Boundary Audits:** No service may directly access another service's storage engine; cross-service communication is restricted to verified network APIs.
* **Container Integrity:** Every service baseline must compile into an isolated, independent OCI container image capable of deployment inside a Kubernetes mesh environment.
