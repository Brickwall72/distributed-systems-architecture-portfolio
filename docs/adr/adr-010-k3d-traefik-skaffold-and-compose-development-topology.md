# ADR-010: Dual-Mode Local Development with k3d, Traefik, Skaffold, and Docker Compose

## Status
Accepted

* **Date:** 2026-09-08
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
The repository contains a distributed microservice and hierarchical micro-frontend topology that must be developed at two different levels of fidelity. Integrated frontend work requires Kubernetes service discovery, Ingress routing, module federation paths, and a browser-facing entrypoint that resembles the deployed topology. Individual service work should remain inexpensive to start, fast to rebuild, and independent of a complete Kubernetes environment.

Using only a local Kubernetes cluster makes every small service change pay the storage and startup cost of the complete platform. Using only Docker Compose makes it difficult to validate the Kubernetes-specific routing and deployment behavior that the platform architecture requires. A single local runtime therefore cannot optimize both workflows.

The development topology must also avoid competing ingress controllers, stale Kubernetes contexts, manual port-forwarding, and divergent browser URLs between local environments.

## Decision Drivers
* **Integrated Development Fidelity:** Reproduce the Kubernetes networking, Ingress, and module federation path structure during full-platform development.
* **Iteration Cost:** Keep isolated service development lightweight enough for machines with limited storage and memory.
* **Fresh-Environment Reproducibility:** Make a new workstation or WSL environment converge on one named cluster, one ingress controller, and one documented browser entrypoint.
* **Continuous Development:** Allow source changes to flow through image builds, local image loading, manifest application, and readiness checks without manual deployment steps.
* **Runtime Boundary Clarity:** Keep the integrated Kubernetes workflow and the direct Compose workflow explicit so their ports, service discovery, and lifecycle assumptions are not mixed.

## Decision
Adopt a dual-mode local development topology:

1. **k3d is the standard integrated Kubernetes runtime.**
   - The default cluster is named `platform-cluster` and is selected through the `k3d-platform-cluster` kubectl context.
   - The k3d load balancer maps host port `8080` to port `80` and host port `8443` to port `443`.
   - The k3s bundled Traefik installation is disabled so that the repository has one authoritative ingress controller.

2. **Traefik is installed and managed by Helm.**
   - The `traefik/traefik` chart is installed into the `traefik` namespace with `helm upgrade --install`.
   - Traefik owns the `web` entrypoint used by the Kubernetes Ingress resources.
   - The browser-facing integrated application contract is `http://localhost:8080`; no manual `kubectl port-forward` is required.

3. **Skaffold owns integrated continuous development.**
   - `skaffold.yaml` builds the local service, client, and shell images, loads them into the k3d nodes, applies the Kubernetes manifests, and watches for source changes.
   - The existing Kubernetes route contract remains centralized at the Traefik entrypoint, including global and domain shells, federated `remoteEntry.js` assets, and API paths.
   - The global shell and domain shells use the `localhost:8080` route contract when running through Kubernetes.

4. **Docker Compose remains the service-level development and testing runtime.**
   - Service-owned Compose definitions remain decentralized and are composed by the root `compose.yaml` through native `include:` entries, consistent with ADR-006.
   - Compose is used for focused container development, direct service testing, local database access, and lower-cost iteration without requiring k3d.
   - Compose publishes direct service ports such as global shell `3000`, topology client `3011`, compliance client `3021`, PDF client `4011`, topology API `8082`, PDF API `4001`, and Neo4j `7474`/`7687`.
   - Compose does not claim the integrated Kubernetes entrypoint at port `8080`.

5. **Shared application contracts must remain runtime-aware.**
   - Kubernetes environment values point federated remotes and browser APIs through Traefik at `localhost:8080`.
   - Compose environment values point directly to Compose-published ports or Compose service names as appropriate.
   - Runtime-generated assets, such as the global shell UI manifest, are generated from tracked templates at container startup and are not committed as source artifacts.

## Consequences
* **Positive (Benefits):** Full-platform development exercises the actual Kubernetes Ingress and module federation topology while preserving a stable browser URL at `localhost:8080`.
* **Positive:** Service developers can build and test individual containers without paying the resource cost of the complete k3d cluster.
* **Positive:** The named cluster, disabled bundled Traefik, idempotent Helm release, and bootstrap script reduce context and ingress-controller drift on fresh environments.
* **Positive:** Skaffold provides a continuous development loop while Compose remains useful for focused local and contract-testing workflows.
* **Negative (Risks):** Two supported runtimes require explicit environment, port, and service-discovery configuration and can expose differences if their paths are not tested separately.
* **Negative (Risks):** k3d image loading and the Chromium-containing PDF server image impose substantial storage and startup costs, especially during uncached rebuilds.
* **Negative (Risks):** Developers must avoid running Compose and Kubernetes workloads that publish the same direct host ports at the same time.

## Validation and Compliance Plan
* **Bootstrap Idempotency:** Running `./setup.sh` repeatedly must verify Docker readiness, install or reuse the required toolchain, select or create `platform-cluster`, and upgrade the Helm-managed Traefik release without duplicate-resource failures.
* **Ingress Exclusivity:** The k3d cluster must not run the bundled k3s Traefik alongside the Helm-managed controller. The `traefik` IngressClass and Helm release must be present.
* **Integrated Route Validation:** With Skaffold running, checks must verify `http://localhost:8080/`, global and domain shell routes, all configured federated `remoteEntry.js` paths, and the topology/PDF API health paths.
* **Continuous Development Validation:** Skaffold must build, load, apply, and observe the local images and Kubernetes resources; source changes must trigger the expected rebuild or sync behavior.
* **Compose Validation:** `docker compose config` must resolve the included service graph, and Compose must publish its documented direct ports without binding `8080`.
* **Runtime Asset Validation:** The global shell UI manifest must be valid JSON in both runtimes, with Kubernetes URLs using `localhost:8080` and Compose URLs using their direct shell endpoints.
* **Storage Hygiene:** Cleanup guidance must prefer targeted image and builder-cache pruning. Cluster deletion must be explicit, and routine volume pruning must not be required for normal development.
* **Contract and Unit Test Alignment:** Pact contract tests remain independent of the runtime choice under ADR-009, while unit tests remain isolated under ADR-005. Compose or Kubernetes may support provider/consumer test execution, but neither replaces the contract artifact verification gate.
