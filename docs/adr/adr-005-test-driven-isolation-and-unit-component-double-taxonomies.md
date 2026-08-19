# ADR-005: Test-Driven Isolation and Unit Component Double Taxonomies

## Status
Proposed

* **Date:** 2026-08-18
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
As a distributed microservice architecture scales, verification testing frequently degrades due to unpredictable execution times, flaky connections, and environmental coupling across multi-machine tracks (e.g., shared databases, live network APIs, or local host filesystem structures). To enforce a strict quality gate workflow across local development stations and automated cloud runners, the project requires an explicit architectural standard that isolates code behavior from external system state.

## Decision Drivers
* **Absolute Unit Isolation:** Unit tests must remain entirely side-effect free and decoupled from physical hardware or state layers to ensure deterministic, reproducible results.
* **Execution Velocity:** Tests must run entirely in-memory to prevent filesystem or network latency from slowing down local developer validation loops.
* **Test-Driven Rigor:** Testing assertions must shape implementation boundaries rather than being retroactively written to match pre-existing code layouts.

## Decision
The system enforces strict Test-Driven Development (TDD) principles along with an explicit file isolation and naming convention:

1. **Mandatory Test-Driven Development (TDD) Lifecycle:**
   Test specifications must be constructed prior to, or simultaneously with, the implementation of application features. This rule guarantees that code design boundaries are defined entirely by strict validation constraints before implementation begins.

2. **Isolated Naming Matrix (`*.unit.test.ts`):**
   Pure isolated tests must be explicitly named using the `*.unit.test.ts` extension format. These files are structurally excluded from the production compiler (`tsconfig.json`) and container image copy lines (`Dockerfile`), ensuring zero test code leaks into production images.

3. **Strict Interface Isolation via Test Doubles:**
   Unit tests are strictly forbidden from communicating with live external resources (databases, network APIs, or the host filesystem). To support this, external dependencies are intercepted using a strict test double taxonomy:
   * **Stubs:** Utilized strictly when the unit under test requires intake data flowing *inbound* from an external dependency (e.g., mocking file metadata inputs).
   * **Mocks:** Utilized strictly when the unit under test triggers state-changing *outbound* side effects that require behavioral verification (e.g., testing writing anomalies to external interfaces).

## Consequences
* **Positive (Benefits):** Guarantees high-velocity, multi-threaded test execution loops running entirely in-memory. Eliminates flaky test failures caused by local file or database state drift. Enforces strict code design discipline, minimizing over-engineering.
* **Negative (Risks):** Increases initial up-front engineering setup per ticket, as complex mock and stub scaffolding must be fully mapped out before feature files can be initialized.

## Validation and Compliance Plan
* **Static File Audits:** Static linting and compilation gates must verify that no files matching `*.unit.test.ts` are present inside the production `./dist` output layers.
* **Network and I/O Trapping:** Unit test configurations must include absolute runtime timeouts or network-blocking parameters to ensure no tests accidentally trigger external socket connections or hardware disk mutation tasks.
