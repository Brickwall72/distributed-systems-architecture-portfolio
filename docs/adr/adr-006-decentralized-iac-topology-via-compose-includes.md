# ADR-006: Decentralized Infrastructure as Code (IaC) Topology and Path-Agnostic Inheritance

## Status
Amended (2026-08-26) — Redesigned to utilize zero-dependency configuration workspace packaging for compiler inheritance. This removes hardcoded filesystem traversal paths entirely.

* **Original Date:** 2026-08-18
* **Amended Date:** 2026-08-26
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
Local multi-service development workspaces traditionally suffer from high configuration drift and onboarding friction across different workstation environments. A mechanism is required to bootstrap host machine dependencies natively, while allowing individual subsystems to be built, containerized, and verified both in absolute isolation and within a global multi-container mesh network.

### 🔄 Amendment Context (2026-08-26)
The original decentralized strategy required deeply nested child service directories to navigate backward via fragile path strings (`../../../`) to locate shared configurations. This approach introduced maintenance friction and brittle compiler behavior during directory restructuring chores. 

To achieve a succinct, easily reproducible workspace, the repository establishes configuration inheritance via internal workspace asset packaging instead of relative folder climbing paths.

## Decision Drivers
* **Zero Configuration Portability:** Move onboarding from a blind repository clone to a fully initialized, type-safe development environment with a single command.
* **Subservice Autonomy:** Ensure individual service folders maintain independent operational control, avoiding monolithic configuration file bottlenecks.
* **Path-Agnostic Replicability:** Centralize configuration matrices, tool settings, and global type declarations using internal packages to eliminate copy-pasting and hardcoded parent path assumptions.

## Decision
The system establishes a decentralized, hierarchical Infrastructure as Code (IaC) pipeline split across three coordinated layers:

1. **Idempotent Host Bootstrapping (`setup.sh`):**
   A centralized, cross-platform bash script automatically audits host OS environments, resolves shared system library dependencies, anchors localized package managers, and executes project dependency installations strictly against an immutable `pnpm-lock.yaml` ledger using strict script safeguards (`--ignore-scripts`).

2. **Decentralized Orchestration Composition (Compose Includes):**
   Individual service modules maintain their own isolated `compose.yaml` files inside their respective folders. The root-level `compose.yaml` file acts as a thin shell orchestrator, using native `include:` statements to dynamically pull services into the shared `platform-mesh` network bridge at runtime.

3. **Decoupled Tooling Packaging (TypeScript Compiler Inheritance):**
   - **Shared Asset Workspace:** Establish a dedicated, zero-dependency configuration package (`packages/tsconfig/`). It exports strict language properties via a centralized `base.json` template file and encapsulates universal ambient type definitions (`types/ambient.d.ts`).
   - **Node Module Resolution Climbing:** Child services inherit these global rules by declaring the package namespace via the `extends` directive. Because pnpm symlinks the shared asset package into the monorepo graph, compiler paths resolve natively through standard Node module directory climbing, completely removing relative parent-directory walking strings (`../../../`) from child manifests.

## Consequences
* **Positive (Benefits):** Achieves complete multi-machine alignment with a zero-drift environment stand-up pipeline. Individual service containers can be launched and tested autonomously without the memory overhead of spinning up all repository modules simultaneously.
* **Positive (2026-08-26):** Transitioning to package-based compiler inheritance removes fragile folder-depth strings from child `tsconfig.json` configurations. This makes service folders fully portable; they can be relocated anywhere in the file tree with zero path modifications required.
* **Positive (2026-08-26):** Bundling universal ambient types directly into the shared asset package ensures they cascade automatically to every subsystem, clearing IDE lookup failures cleanly.
* **Negative (Risks):** Requires that the root `tsconfig.json` file utilize a direct relative path map (`./packages/tsconfig/base.json`) to read the base configuration, as pnpm does not generate self-referencing package symlinks at the absolute repository root layer.

## Validation and Compliance Plan
* **Idempotency Verification Probes:** Onboarding tracking scripts must verify that running `./setup.sh` multiple times on a fully configured machine returns a soft verification check in under two seconds without mutating active configurations.
* **Climbing Resolution Verification:** Service-level TypeScript compilation tasks must execute natively within their local subdirectories via `tsc -p tsconfig.json` to prove configuration and type inheritance pass cleanly without relying on relative path walking.
