# ADR 007: Frontend Architecture Matrix and Component Governance

## Status
Amended (2026-08-22) — Redesigned to authorize React/Tailwind inside shared monorepo packages and record the decommissioning of the custom pdf-viewer microservice.

* **Original Date:** 2026-08-20
* **Amended Date:** 2026-08-22
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context
As the monorepo architecture scales out of isolated backend processing utilities and transitions into core user presentation layers, we must codify a unified, enterprise-grade frontend engineering stack. This stack must guarantee strict UX consistency, accessibility compliance, low visual degradation, and deterministic component isolation across multi-environment workspaces.

### 🔄 Amendment Context (2026-08-22)
The original multi-tiered architecture forced shared widgets inside `/packages/` to utilize Vanilla TypeScript and raw CSS (BEM). During development of the `pdf-viewer` presentation layer, this constraint created severe architectural friction, requiring fragile relative-path CSS overrides, complex Web Worker pathing, and heavy bundler bloat. 

Furthermore, the initial system layout conceptualized the PDF viewer as an independent, heavy microservice pipeline. To minimize infrastructure bloat for the MVP, the standalone `pdf-viewer` microservice is **officially decommissioned**. 

To preserve rapid delivery velocities, the architecture shifts to a streamlined, unified frontend model. Shared monorepo packages are fully authorized to use the primary React and Tailwind CSS stack [7.1]. Document viewing will leverage native HTML `<iframe>` browser viewports as a clean, zero-dependency interim strategy for the MVP, insulating the frontend behind a standard URL string property contract.

## Decision
We establish a single, unified frontend component governance framework to optimize architectural flexibility and maintain a strict separation of concerns across the monorepo:

1. **Unified Frontend Technical Stack (Applications & Shared Packages):**
   - **Framework:** React + TypeScript + Radix Primitives / Shadcn/ui + Tailwind CSS [7.1].
   - **Rationale:** Standardizing on a single stack across both primary dashboards (e.g., `compliance-service` UI) and shared utilities (inside `/packages/`) removes compile-time context switching and ensures 100% design token and type parity [7.1].
   - **Styling Best Practice:** Components must utilize inline Tailwind CSS utility classes directly within their template files [7.1]. This maximizes performance, minimizes production bundle size, and preserves accurate component-level Separation of Concerns [7.1]. Separate `.css` structures and `@apply` rules are deprecated to prevent stylesheet bloat [7.1].

2. **Interim Document Rendering Control:**
   - **Tooling:** Native HTML `<iframe>` Elements.
   - **Rationale:** Offloads binary stream parsing directly to the host browser thread. By passing a standard string URL path contract, the underlying iframe player can be seamlessly swapped out for a high-fidelity rendering canvas (like `react-pdf`) in a future optimization phase without modifying core business logic.

3. **Verification and Isolation Gate:**
   - **Tooling:** Storybook.
   - **Rationale:** Establishes an active developer sandbox ecosystem to render, visualize, and interactively audit frontend interfaces completely isolated from physical backend servers or active live network states.

## Consequences
- **Positive:** Developers have an unambiguous blueprint for choosing toolsets based on component type. Accessibility and design themes are systematically hardcoded into the baseline platform layer.
- **Positive (2026-08-22):** Allowing shared packages to consume React and Tailwind directly eliminates custom CSS compilation boilerplate and removes complex relative-path asset leaks [7.1].
- **Positive (2026-08-22):** Decommissioning the custom PDF-viewer microservice strips third-party dependency bloat out of the package tree and removes cross-origin rendering blocks over virtual networks.
- **Negative:** None. Standardizing on a single, modern utility-first stack across the entire monorepo eliminates the architectural friction of the previous multi-tiered framework models [7.1].
