# Helm charts

One chart per deployable workload, sharing templates from the `platform-lib`
library chart. The integrated Skaffold workflow deploys all of them; direct
Helm installs are used by the funnel smoke test and the demo VM.

| Chart | Deploys |
| --- | --- |
| `topology-service` | Topology server, client, and Neo4j (PVC-backed; see `values-demo.yaml` for demo VM sizing) |
| `compliance-service` | Compliance server, client, and PostgreSQL |
| `audit-ledger` | Audit server, client, and MongoDB |
| `auth-service` | Auth server and client |
| `pdf-service` | PDF generator server |
| `esign-service` | E-sign server |
| `global-shell`, `compliance-shell`, `topology-shell` | Global and domain UI shells |
| `minio` | MinIO and the provisioning Job (see [infrastructure/minio-setup](../infrastructure/minio-setup/README.md)) |
| `nats` | NATS with JetStream and per-service accounts |
| `dbgate` | Local database administration UI (disabled by default; never expose publicly) |
| `jaeger` | Trace collection and query (see [observability](../docs/development/observability.md)) |
| `network-policies` | Namespace network policies; configure the Traefik namespace/pod labels to match the ingress |
| `traefik-shared` | Shared cluster-wide Traefik middlewares, installed once by `pnpm helm` |
| [`platform-lib`](./platform-lib/README.md) | Template library for server, client, shell, and database workloads; consuming charts supply values |

Run `pnpm charts:deps` after clone and whenever `platform-lib` or a chart's
`Chart.yaml` dependencies change: it vendors `platform-lib` into each chart's
`charts/` directory.

Chart defaults are public-safe: DBGate and the MinIO/NATS management ingress
routes are disabled, and database/MinIO/NATS/DBGate PVCs are retained on
uninstall. The local Skaffold workflow explicitly enables the local admin
routes; `pnpm helm` uses `traefik-values-local.yaml` for the local Traefik
dashboard, which a public deployment must not use. See
[Kubernetes development](../docs/development/kubernetes-development.md) for the
local workflow and
[demo secrets](../docs/operations/demo-secrets.md) for public-exposure
settings.
