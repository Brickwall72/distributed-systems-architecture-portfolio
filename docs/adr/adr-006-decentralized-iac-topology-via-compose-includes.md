# ADR-006: Decentralized Infrastructure as Code (IaC) Topology via Compose Includes

## Status
Accepted

* **Date:** 2026-08-18
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
Local multi-service development workspaces traditionally suffer from high configuration drift and massive onboarding friction across different workstation environments. A mechanism is required to bootstrap host machine dependencies (Node.js runtimes, Docker daemons, package managers) natively, while allowing individual subsystems to be built, containerized, and verified both in absolute isolation and within a global multi-container mesh network.

## Decision Drivers
* **Zero Configuration Portability:** The onboarding sequence must move from a blind repository clone to a fully initialized, type-safe development environment with a single command.
* **Subservice Autonomy:** Individual service folders must maintain independent operational control, avoiding a single, massive monolithic file bottleneck.
* **Environment Configuration Isolation:** Local workstation data structures, caches, and variable definitions must be decoupled from the core container orchestration configurations.

## Decision
The system establishes a decentralized, self-healing Infrastructure as Code (IaC) pipeline split across two distinct layers:

1. **Idempotent Host Bootstrapping (`setup.sh`):**
   A centralized, cross-platform bash script automatically audits host OS environments, resolves shared system library dependencies (e.g., `libatomic1` linking for Node 25+ Linux compatibility), anchors localized package managers, and executes project dependency installations strictly against an immutable `pnpm-lock.yaml` ledger using strict script execution safeguards (`--ignore-scripts`).

2. **Decentralized Orchestration Composition (Compose Includes):**
   A centralized monolithic container orchestration file is rejected. Individual service modules maintain their own isolated `compose.yaml` files inside their respective folders, interpolating parameters exclusively from localized, non-committed `.env` sibling profiles. To support standalone testing, services use local network creation fallbacks (Pattern B). The root-level `compose.yaml` file acts as a thin shell orchestrator, using native `include:` statements to dynamically pull services into the shared zero-egress `platform-mesh` network bridge at runtime.

## Consequences
* **Positive (Benefits):** Achieves complete multi-machine alignment with a zero-drift environment stand-up pipeline. Individual service containers can be launched and tested autonomously without the memory overhead of spinning up all 8 repository modules simultaneously.
* **Negative (Risks):** Requires deeper build context tracking paths (`context: ../../../`) to ensure deeply nested service directories can crawl up and read the centralized repository package ledger during multi-stage image compilation.

## Validation and Compliance Plan
* **Idempotency Verification Probes:** Onboarding tracking scripts must verify that running `./setup.sh` multiple times on a fully configured machine returns a soft verification check in under two seconds without mutating active configurations.
* **Context Boundary Verification:** Multi-stage container builds must be audited to ensure that local workstation caches (`node_modules`) are strictly blocked from entering the compilation workspace via explicit root `.dockerignore` files.
