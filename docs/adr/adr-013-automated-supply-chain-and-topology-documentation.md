# ADR-013: Automated Supply Chain Inventory Tracking and Polymorphic Topology Visualization

## Status
Accepted

* **Date:** 2026-11-01
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
Maintaining an accurate list of third-party dependencies, open-source compliance profiles, and multi-service architectural relationships across a complex pnpm monorepo containing 9 containerized images introduces extreme manual tracking overhead. Traditional documentation approaches degrade quickly as codebases evolve, causing configuration drift. The system requires an automated pipeline to extract structural Software Bill of Materials (SBOM) ledgers and display multi-tier runtime communications (UI Shell composition, HTTP/REST, NATS Request-Reply, and NATS Pub/Sub) visually without functioning as a blocking security gate or generating Git history diff noise.

## Decision Drivers
* **Living System Documentation:** Automate asset and layout tracking directly from active build systems (Skaffold) to ensure zero documentation decay.
* **Agnostic Presentational Richness:** Generate highly visual, searchable, and human-readable charting arrays (CycloneDX Sunshine, Mermaid) for portfolio display purposes.
* **Idempotent Automation Hygiene:** Prevent volatile data shifts (like fluctuating timestamps or transient artifact UUIDs) from polluting pull request histories on every run.

## Decision
Implement a decoupled, Python-driven automation documentation suite executed locally and enforced via GitHub Actions:

1. **Automated Supply Chain Auditing (Trivy & Sunshine):**
   Utilize Aqua Security's `Trivy` scanner exclusively in license-auditing mode to parse image filesystems. Pipe resulting CycloneDX JSON blocks into [CycloneDX Sunshine](https://github.com/CycloneDX/Sunshine "CycloneDX/Sunshine") to output interactive, visual sunburst charting tools.
2. **Polymorphic Architecture Mapping:**
   Establish a central, validated configuration map (`model.json`) to govern cross-service relationship rules. Map these rules into dynamic, inline GitHub Markdown (Mermaid) blocks and standalone HTML canvases.
3. **Idempotent Synchronization Processing:**
   Incorporate an explicit data hashing step (`sync_generated_reports.py`) to intercept compiled outputs, evaluating changes solely against image IDs and component versions to filter out volatile metadata noise.
4. **Non-Destructive Bot PR Automation:**
   Configure GitHub Actions to push generated documentation updates directly to an isolated branch (`automation/generated-documentation`), opening an automated, tracked Pull Request back to master without violating repository branch protection bounds.

## Consequences
* **Positive (Benefits):** Guarantees that documentation, license mappings, and cross-service relationship flows update automatically with every master check-in without requiring manual updates.
* **Positive:** Sunshine components provide a highly professional, human-readable presentation format that clearly showcases supply chain transparency.
* **Negative (Risks):** `model.json` requires manual synchronization whenever microservice interaction boundaries or routing channels shift.
