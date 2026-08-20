# ADR 007: Frontend Architecture Matrix and Component Governance

## Status
Accepted

* **Date:** 2026-08-20
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context
As the monorepo architecture scales out of isolated backend processing utilities and transitions into core user presentation layers (such as the `pdf-viewer` widget presentation layer and upcoming document management panels), we must codify a unified, enterprise-grade frontend engineering stack. This stack must guarantee strict UX consistency, accessibility compliance, low visual degradation, and deterministic component isolation across multi-environment workspaces.

## Decision
We establish a two-tiered frontend component governance framework to optimize architectural flexibility and maintain a strict separation of concerns:

1. **Standalone Platform Utilities / Core Widgets:**
   - **Stack:** Vanilla TypeScript + Semantic CSS Stylesheets (BEM Namespace pattern).
   - **Rationale:** Keeps downstream platform components completely framework-agnostic. These packages can be embedded with zero overhead into cloud web interfaces, headless Chromium sandboxes, or local desktop Electron shells.
   - **Styling:** Isolated inside local colocated `.css` structures to avoid forcing build configuration compiler dependencies onto parent applications.

2. **Primary Application Frontends (User Dashboards / Core Gateways):**
   - **Stack:** React + TypeScript + Radix Primitives / Shadcn/ui + Tailwind CSS.
   - **Rationale:** Leverages Radix's WAI-ARIA compliant, headless keyboard accessibility layouts while utilizing Tailwind's utility compilation engine to guarantee uniform design systems and theme parity.

3. **Verification and Isolation Gate:**
   - **Tooling:** Storybook.
   - **Rationale:** Establishes an active developer sandbox ecosystem to render, visualize, and interactively audit both vanilla platform widgets and React application components completely isolated from physical backend servers or active live network states.

## Consequences
- **Positive:** Developers have an unambiguous blueprint for choosing toolsets based on component type. Accessibility and design themes are systematically hardcoded into the baseline platform layer.
- **Negative:** Vanilla platform widgets cannot consume Shadcn layout tokens natively; visual styles inside vanilla widgets must be mirrored manually using raw CSS values corresponding to the Tailwind theme matrix.
