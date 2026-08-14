# ADR-002: Implementation of Unified Monorepo Framework and Software Quality Gates

## Status
Accepted

* **Date:** 2026-08-14
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
Operating an 8-service distributed architecture (5 core domain services and 3 platform utilities) requires precise interface boundaries. Distributing these components across 8 individual source control repositories introduces heavy configuration drift, complicates synchronized version patching, and obscures architectural traceability during technical verification audits.

## Decision Drivers
* **Architectural Traceability:** Code integration must be highly audit-ready, allowing cross-service changes to be tracked together.
* **Release Synchronization:** Modifying a core protocol or shared network interface must not require managing 8 distinct repository release pipelines.
* **Local Workspace Velocity:** The development workspace must allow rapid, localized multi-service compilation and cluster container orchestrations.

## Decision
All software subsystems, deployment infrastructure manifests, and systems engineering documentation are housed within a single unified Monorepo framework titled `distributed-systems-architecture-portfolio`.

The physical directory hierarchy is managed as follows:
* `/services/core/` – Houses isolated, domain-specific business logic microservices.
* `/services/platform/` – Houses stateless, reusable utility wrappers.
* `/docs/` – Houses system blueprints, Interface Control Documents (ICDs), and chronological ADR logs.

To prevent baseline pollution within this single tree, a strict branch protection quality gate ("Strict-Main-Gate") is enforced at the remote server level. Direct pushes to the `master` branch are blocked. All integrations require sandboxed feature branches, Conventional Commit syntax, and formalized Pull Request reviews.

## Consequences
* **Positive (Benefits):** Delivers absolute visibility into the entire system topology in a single workspace. Enables atomic modifications across cross-service contracts to be tracked, reviewed, and mainlined within a single, cohesive Pull Request.
* **Negative (Risks):** Requires rigorous local workspace discipline and build pipeline filtering to prevent internal code boundary bleed or accidental cross-service package sharing.

## Validation and Compliance Plan
* **Linear Git History Audit:** The remote repository will block merge commits, forcing a squash-and-merge or rebase workflow to guarantee a straightforward, audit-ready version timeline.
* **Conventional Commit Compliance:** Every pull request title and merge commit must enforce standard conventional formatting tags to allow automated parsing of software changes.
