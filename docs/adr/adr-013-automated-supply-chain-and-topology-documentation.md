# ADR-013: Internal Dependency References and Architecture Visualization

## Status
Amended (2026-11-22) - Original decision accepted on 2026-11-01; replaced
external image inventories with source-based internal dependency and
connection-boundary references.

The original image-scanned third-party inventory decision has been
replaced by source-based first-party dependency and boundary-call reporting.
CI now generates reports and opens or updates a generated-documentation PR
after successful `master` verification. This does not change CI test-selection
policy.

* **Date:** 2026-11-01
* **Amended Date:** 2026-11-22
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
### Amendment Context (2026-11-22)

The original implementation generated per-image third-party inventories and an
architecture overview. The external inventories did not answer which internal
components might be affected by a change. The useful reference is normally a
database/server/widget/shell-page slice, with explicit API/event contracts for
genuine cross-service impact.

## Decision Drivers
* **Internal impact evidence:** Identify consumers and providers, source locations,
  connection-boundary functions, and immediate callers without inferring that
  all services using shared infrastructure depend on one another's payloads.
* **Human and machine references:** JSON, Markdown, and HTML alongside the
  existing architecture overview.
* **Deterministic, inexpensive generation:** Work from source without image
  builds, active services, scanner downloads, or volatile output metadata.
* **Honest coverage:** Show unresolved static-analysis facts explicitly.

## Decision
1. Discover first-party workspaces and dependencies from tracked package
   manifests and deployable images from Skaffold declarations.
2. Use standard TS/TSX parser tooling to extract supported HTTP, NATS, storage,
   and federation boundary calls, their enclosing functions, immediate local
   callers, and resolvable contract/subject identifiers.
3. Reuse the validated architecture model for runtime relationships; derive
   federation composition from current source. Keep dependency direction
   separate from possible downstream-impact direction.
4. Generate deterministic internal JSON/Markdown/HTML and the overview locally
   through `pnpm docs:generate`. Synchronize only a validated report bundle by
   content, with no image-identity or scanner-version special cases.
5. Remove the obsolete external generator, scanner setup, metadata handling,
   tests, and generated inventories. Generate reports in CI and publish changes
   through a reviewable PR without changing CI test selection.

## Consequences
* **Positive:** Reports explain internal vertical slices and real cross-service
  boundaries without requiring container builds.
* **Positive:** Source-linked functions/calls complement the overview graphic.
* **Limitation:** Dynamic bindings and runtime behavior cannot always be resolved
  statically; the report is not a breaking-change verdict.
* **Limitation:** Runtime facts retained in the model still need maintenance.
* **Scope:** This replaces the external inventory, not a security scanner; CI
  integration of the graph is a separate decision.
