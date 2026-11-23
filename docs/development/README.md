# Development guide

How to set up and work on the platform locally. Start with
[environment setup](./setup.md), then pick a workflow:

- [Setup](./setup.md) — prerequisites, bootstrap (`setup.sh`), environment
  files, and credential preparation.
- [Integrated Kubernetes development](./kubernetes-development.md) — the
  primary workflow: k3d, Helm, Traefik, and Skaffold with live rebuilds.
- [Service-level Compose development](./compose-development.md) — working on
  individual containers without the Kubernetes stack.
- [Credentials, accounts, and resets](./credentials-and-resets.md) — the
  per-service account model, credential rotation, and explicitly confirmed
  destructive resets.
- [Testing](./testing.md) — unit, contract, and isolated integration suites.
- [Observability](./observability.md) — correlated diagnostic logs and backend
  tracing with Jaeger.
- [Cleanup and storage](./cleanup-and-storage.md) — tearing down workflows and
  reclaiming Docker storage safely.
- [Troubleshooting](./troubleshooting.md) — common failure symptoms and fixes.

Operational procedures for the public demo VM live in
[docs/operations](../operations/). Contribution workflow and commit standards
are in [contributing](../contributing.md). Service-specific behavior is
documented in each service's own README under [services/](../../services/).
