# ADR-010: Dual-Mode Local Development with k3d, Helm, Traefik, Skaffold, and Docker Compose

## Status
Amended (2026-09-26) — Updated to integrate production-ready, multi-stage OCI build contours across all services and configure internal Nginx proxy routing rules within the production shell layers to preserve path parity across runtimes.

* **Date:** 2026-09-08
* **Author:** Sam Brickett
* **Deciders:** Sam Brickett
* **Consulted:** N/A (Solo Project)

---

## Context and Problem Statement
The repository contains a distributed microservice and hierarchical micro-frontend topology that must be developed at two different levels of fidelity. Integrated frontend work requires Kubernetes service discovery, Ingress routing, module federation paths, and a browser-facing entrypoint that resembles the deployed topology. Individual service work should remain inexpensive to start, fast to rebuild, and independent of a complete Kubernetes environment.

Using raw, duplicated Kubernetes YAML manifests across standalone services introduces severe configuration drift and maintenance strain. Furthermore, mismatched pathing semantics between Docker Compose direct-port bindings and Kubernetes Ingress definitions force micro-frontend shells and API clients to maintain separate endpoint configurations, breaking workspace transparency.

Transitioning to production-grade container builds requires isolating heavy compilation dependencies from final runtimes, enforcing lean image footprints, and managing static file asset distribution without breaking the path-based gateway parameters established across the ecosystem.

## Decision Drivers
* **Integrated Development Fidelity:** Reproduce exact cloud-native networking, Ingress, and module federation path structures across all local development tasks.
* **Unified Path Abstraction:** Enforce identical path-based routing patterns across both Kubernetes and Compose to eliminate hardcoded service port values from source assets.
* **Maintainable IaC Infrastructure:** Consolidate disparate service infrastructure templates into structured, version-controlled Helm charts.
* **Symmetrical Optimization Limits:** Build lightweight, multi-stage optimized execution profiles to streamline memory allocations across active developer machines.

---

## Decision
Adopt a fully unified, path-abstracted dual-mode local development topology:

1. **Helm Chart Monorepo Layout (`/charts/`):**
   - Raw Kubernetes manifest folders at `k8s/local/` are completely deprecated and removed. All system components, volumes, initialization jobs, and ingress boundaries are managed cleanly via localized Helm charts.

2. **Mirrored Traefik Gateway Ingress Configuration:**
   - Authoritative ingress gateways handle traffic routing using identical path patterns across both execution runtimes by mirroring core rule structures.
   - **Docker Compose Mode:** Traefik maps to the standard HTTP gateway port (**`http://localhost`**). A dedicated reverse-proxy node intercepts traffic, prepends/strips domain paths via compose rules, and forwards clean requests to internal container sockets.
   - **Kubernetes Mode:** Traefik maps to host port **`8081`** via k3d load balancers (`http://localhost:8081`). The baseline routing definitions are mirrored from the Compose setups straight into the active Helm configuration values to drive the cluster ingress loops.
   - *Note: Running Compose over port 80 and Kubernetes over port 8081 is an intentional design boundary to support simultaneous runtime runs if needed without host socket assignment conflicts.*

3. **Multi-Stage OCI Build Contours:**
   - Every core microservice, platform utility, and web shell workspace implements a standardized, multi-stage `Dockerfile`. 
   - Build loops separate targets cleanly into three layers: `builder` for asset installation and dependency trees, `dev` for mounting live hot-reloaded development workspaces, and `prod` for serving secure, highly compressed production assets.

4. **Production Shell Nginx Configurations:**
   - Web shells (`global-shell` and domain coordinators) implement a high-performance production Nginx server layer inside their production build stages. 
   - The global shell's embedded `nginx.conf` handles path preservation rules natively using internal proxy blocks (`location /topology-shell/`, `location /compliance-shell/`) to forward request streams directly to adjacent containers while injecting explicit CORS Access-Control headers to support secure `mf-manifest.json` asset delivery.

5. **Decoupled Application Routing:**
   - Backend microservice routers remain completely agnostic of domain routes in their source files (listening natively on root `/api/v1/*` paths). Traefik edge configurations are solely responsible for prepending, evaluating, and stripping domain path prefixes (`/topology`, `/compliance`, `/pdf`) before forwarding traffic to underlying application servers.

6. **Skaffold Continuous Development:**
   - `skaffold.yaml` coordinates continuous image compilation, automatically streams localized changes straight into k3d pods, and manages Helm upgrade chart deployment dependencies.

---

## Consequences
* **Positive (Benefits):** Full-platform development exercises actual production Helm tracking parameters and path routes while locking down clean browser entrypoints.
* **Positive:** Port conflicts are completely engineered out of the micro-frontend layers, removing proxy mapping scripts from client workspaces.
* **Positive:** Production shell targets leverage compiled multi-stage caching, optimizing image layer extraction speeds and dramatically shrinking runtime container RAM footprints.
* **Negative (Risks):** Manual replication of routing rules between Compose files, Helm values fields, and Nginx location blocks introduces temporary maintenance overhead and must be hardened against configuration drift in a future infrastructure pass.

---

## Validation and Compliance Plan
* **Helm Manifest Auditing:** Executing `helm lint` against the local charts directory must return a 100% green pass with zero configuration validation exceptions.
* **Path Resolution Pass:** Booting the system via either Skaffold or Docker Compose must allow the global shell browser layer to mount all federated components flawlessly using mirrored Traefik-proxied domain prefix paths.
* **Multi-Stage Integrity Audits:** Verifying that forcing an image build targeting the `prod` layers generates ultra-lean container assets that serve static web files cleanly through Nginx without leaking development source code tools.
* **Simultaneous Run Audit:** Verifying that running `docker compose up` and `skaffold run` simultaneously does not throw host socket binding errors due to port 80/8081 orchestration limits.
