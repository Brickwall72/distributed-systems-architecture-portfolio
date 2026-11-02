# ADR-014: Polymorphic Data Validation and Interface Mapping via Hierarchical Zod Pipelines

## Status
Accepted

* **Date:** 2026-11-01
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
Managing inter-service communication payloads across various protocol vectors (HTTP REST, NATS Request-Reply, and asynchronous streaming meshes) often introduces parameter structural drift and validation duplication debt. Hardcoding manual parameter destructuring loops, spread operations, and object conversion wrappers across client widgets creates significant boilerplate friction. Furthermore, forcing a single monolithic data contract configuration globally violates Bounded Context isolation principles, causing local subsystem updates to unintentionally break unrelated external services.

## Decision Drivers
* **Strict Boundary Isolation:** Enforce absolute data validation parameters at the entry gate of every server-side controller and frontend component.
* **Polymorphic Transform Execution:** Eliminate code-level object-mapping boilerplate by embedding data transformation paths directly into contract declarations.
* **Autonomy vs. Wire Stability:** Support local subsystem flexibility without compromising global wire contract security rules.

## Decision
Overhaul the repository's validation layers to utilize **Reverse-Chained Hierarchical Zod Pipeline Models**:

1. **Reverse-Chained Contract Engineering:**
   Compile data contracts by moving backward from the final target destination schema toward the entry fields. Merge downstream requirements together while employing a custom `omit` helper utility to automatically prune internally generated or server-side metadata properties, ensuring ingress gates never demand fields derived internally.
2. **Declarative Pipeline Transformations (`zod.pipe`):**
   Utilize `zod.pipe()` and `zod.transform()` natively inside data contracts to execute parameter-mapping logic at the validation gate. This lets local subsystems digest light, contextual data models while seamlessly validating against global canonical structures.
3. **Twin-Tier Contract Footing:**
   Maintain completely separate subsystem-local schemas alongside globally published wire contracts (`/packages/contracts/`). Ensure cross-boundary safety by implementing contract-boundary structural comparison tests backed by `zocker` dynamic test data synthesis to let the compiler prove wire alignment.

## Consequences
* **Positive (Benefits):** Drastically reduces file line length and boilerplate code noise by handling parameter mapping rules inside declarative schemas instead of application functions.
* **Positive:** Isolates change impact—subsystems can safely evolve their internal database or operational attributes without accidentally crashing external application compilation graphs.
* **Positive:** `zocker` integrations eliminate fragile, hardcoded JSON test fixtures, ensuring unit testing matrices scale effortlessly alongside contract adjustments.
