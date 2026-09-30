# ADR-012: Incremental Build Graph Orchestration via Turborepo Caching Profiles

## Status
Accepted

* **Date:** 2026-09-30
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
As the distributed platform expands across multiple microservices (`esign-service`, `compliance-service`, `topology-service`), domain shells, and shared contract packages (`packages/contracts/*`), the number of localized unit and Pact contract test suites has scaled. Executing the entire validation tree sequentially on every commit introduces extreme pipeline latency inside the continuous integration (`ci.yaml`) workflow, creating a development velocity bottleneck.

Running tests across untouched subdirectories wastes computational memory and runner time. The monorepo requires an authoritative task runner capable of parsing project dependency graphs and skipping execution suites for modules that have not undergone source changes.

## Decision Drivers
* **Pipeline Velocity Optimization:** Compress CI runtimes by enforcing incremental task execution.
* **Granular Dependency Tracing:** Ensure that changes made to shared packages (e.g., `@contracts/esign`) automatically trigger downstream test runs for dependent services while skipping isolated, untouched nodes.
* **Deterministic Build Reproducibility:** Guarantee that caching mechanisms maintain strict hash transparency across local developer workstations and remote GitHub Actions runners.

---

## Decision
Integrate **Turborepo (`turbo`)** into the `pnpm` monorepo toolchain as the authoritative task orchestration manager.

1. **Dependency Graph & Task Configuration (`turbo.json`):**
   Establish a root-level `turbo.json` configuration profile mapping workspace dependencies. Execution pipelines for unit testing (`test:unit`), contract validation (`test:contract`), and compilation (`build`) are defined with explicit input/output file patterns and environment variables.

2. **Granular Artifact Hashing:**
   Turborepo evaluates workspace file contents, package manifest lockfiles, and environment criteria to generate distinct execution hashes. If a package's hash matches a prior successful verification step, execution is bypassed and cached outputs are restored instantly.

3. **CI Pipeline Integration & Local Cache Persistence:**
   Refactor `.github/workflows/ci.yaml` to trigger workflow tasks using `pnpm turbo run <task>`. To prevent cache misses on ephemeral GitHub Actions runners, `ci.yaml` will explicitly persist and restore the `.turbo` cache directory via `actions/cache` keyed on commit and lockfile hashes.

---

## Consequences
* **Positive (Benefits):** Significantly reduces local and remote pipeline latency. Unmodified service apps safely bypass execution blocks, providing immediate feedback on targeted PRs.
* **Positive:** Shared contract modifications accurately force widespread downstream validation without requiring manual script maintenance.
* **Negative (Risks & Overhead):** Requires maintaining accurate `inputs`, `outputs`, and `dependsOn` declarations inside root `turbo.json` to prevent stale caches from masking compilation or test failures.
* **Negative:** Requires monitoring GitHub Actions cache storage consumption to remain within repository limits.

---

## Validation and Compliance Plan
* **Incremental Cache Audit:** Modifying an isolated test file inside `services/platform/esignature-service` (`esign-service`) must prove that running `pnpm turbo run test:unit` executes checks *only* inside that specific package directory, outputting `FULL TURBO` cache-hit logs for unaffected core services (`compliance-service`, `topology-service`).
* **CI Cache Hit Verification:** Inspect GitHub Actions logs for `.github/workflows/ci.yaml` to confirm that second-run commits with unmodified packages successfully restore `.turbo` artifacts and bypass redundant step execution.