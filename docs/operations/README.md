# Operations guide

Procedures for the public demo deployment on the dedicated single-node k3s VM,
and related pre-deployment checks. These are operator procedures with
deliberate safety gates; read the relevant page fully before acting, and never
bypass markers, baselines, or confirmation prompts.

- [Demo secrets](./demo-secrets.md) — provisioning and upgrading the demo's
  separate credential bundle and Kubernetes Secrets.
- [Demo VM data reset](./demo-vm-reset.md) — the nightly gated baseline
  restore, its systemd units, Discord alerting, Tailscale gating, and offline
  recovery.
- [Demo UI publication and gated updates](./demo-ui-publication.md) — CI image
  selection and publication, VM image prefetch, and UI-only gated Helm updates.
- [Tailscale Funnel smoke test](./funnel-smoke-test.md) — the disposable
  dev-machine test for public exposure through Tailscale Funnel.

The scripts referenced here live in [scripts/demo-vm/](../../scripts/demo-vm/)
and [scripts/ci/](../../scripts/ci/). Local development workflows are in
[docs/development](../development/).
