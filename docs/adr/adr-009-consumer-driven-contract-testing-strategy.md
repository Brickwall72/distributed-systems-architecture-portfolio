# ADR-009: Consumer-Driven Contract (CDC) Testing Strategy

## Status
Accepted (2026-09-06)

* **Date:** 2026-09-06
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
While ADR-005 successfully isolates internal component and controller logic using in-memory test doubles, the microservices architecture (e.g., topology service, PDF generator) communicates across network boundaries. Relying solely on unit tests or end-to-end integration environments leads to brittle test pipelines, slow feedback loops, and silent breaking changes when service data payloads evolve.

## Decision Drivers
* **Pipeline Velocity Optimization:** Eliminate the need to spin up heavy, live multi-container staging environments to verify basic network interface compatibility.
* **Interface Drift Prevention:** Catch broken API contracts, path name mismatches, and parameter drift immediately at build time before merging.
* **Decoupled Development Parity:** Enable rapid, isolated testing of individual widgets and backend routers without requiring a running database or active network mesh.

---

## Decision
Adopt **Consumer-Driven Contract (CDC) Testing using Pact (V3)** as the authoritative quality gate for all inter-service network boundaries.

1. **Boundary Enforcement via Pact:** Client applications define expected data shapes through consumer contract tests (`*.contract.test.ts`). These generate static test artifacts (`pacts/*.json`) that are verified against provider services in CI/CD.
2. **Clean Separation of Concerns:**
   * **Contract Tests (`pacts/`)** exclusively verify wire-level serialization, HTTP methods, status codes, and schema shapes between services.
   * **Unit Tests (`*.unit.test.ts`)** (per ADR-005) focus exclusively on internal controller logic, query parameter parsing, and UI component lifecycles.
3. **Artifact Isolation:** Contract artifacts are strictly used for testing and CI/CD verification gates and are excluded from production runtimes.

---

## Consequences
* **Positive (Benefits):** Eliminates cross-service integration drift, provides fast feedback without heavy staging environments, and cleanly decouples network schema validation from internal code unit tests.
* **Negative (Risks):** Requires maintaining provider state handlers and ensuring consumer contract suites run in lockstep with service updates.
