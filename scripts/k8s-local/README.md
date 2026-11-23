# Local Kubernetes scripts

Lifecycle of the local k3d cluster and its Kubernetes-specific setup. These run
on a developer machine through `pnpm` commands as part of the integrated
Skaffold workflow described in the
[Kubernetes development guide](../../docs/development/kubernetes-development.md).

| Script | Responsibility | Invoked by / when |
| --- | --- | --- |
| `k3d-up.sh` | Creates or selects the `platform-cluster` k3d cluster and sets the `k3d-platform-cluster` context. Maps host ports `8081`/`8443` to the Traefik load balancer. | `pnpm k3d:up`; first step of the integrated workflow. |
| `k3d-down.sh` | Deletes the `platform-cluster` cluster, its node containers, and the Docker volumes mounted by its named k3d nodes. | `pnpm k3d:down`; teardown. |
| `charts-deps.sh` | Vendors the `platform-lib` library chart into every service/shell chart's `charts/` directory. | `pnpm charts:deps`; after clone and whenever `charts/platform-lib` or a chart's `Chart.yaml` dependencies change. |
| `k8s-local-secrets.py` (and `k8s-local-secrets.sh` wrapper) | Creates or verifies the local Kubernetes database, MinIO, NATS, and JWT Secrets in `platform-local` from the service `.env` files. Operates only on context `k3d-platform-cluster`. Checks existing Secrets rather than overwriting them and refuses conflicts. | `pnpm k8s:secrets`; after `pnpm k3d:up` and whenever credentials change. Also run automatically by `pnpm skaffold`. |
| `k3d-funnel-smoke.sh` | Creates/destroys the disposable `dsap-funnel-smoke` cluster and performs direct Helm deployments for the Tailscale Funnel smoke test (`up`, `images`, `deploy <hostname>`, `deploy-loopback`, `down`). Binds host ports to loopback only. | `pnpm k3d:funnel:smoke <command>`; also used by CI's browser smoke test. See the [funnel smoke guide](../../docs/operations/funnel-smoke-test.md). |
