# Demo VM scripts

Operations for the dedicated single-node k3s public demo: secret provisioning,
the nightly gated data reset, Discord alerting, Tailscale gating, and UI-only
gated updates. Everything here runs as root on the demo VM, installed together
under `/usr/local/lib/dsap-demo/` (flat, alongside
`scripts/ci/publish-demo-ui-images.py`, whose manifest validator they import).
The operational procedures, preconditions, and recovery steps live in
[docs/operations/](../../docs/operations/).

| Script | Responsibility | Invoked by / when |
| --- | --- | --- |
| `k8s-demo-secrets.py` | Generates and provisions the demo's high-entropy credentials, JWT keys, and fictional signing certificate as a protected bundle plus Kubernetes Secrets. Later runs compare existing Secrets rather than replacing them; `--upgrade-access-model` upgrades a version-1 bundle. | `pnpm k8s:demo-secrets`; once per demo namespace and for verification/recovery. Also used by the funnel smoke test and CI browser smoke. |
| `k8s-demo-reset.py` | Restores the five local-path volumes from the root-protected baseline at `/var/lib/dsap-demo/baseline`, verifying the credential bundle and Kubernetes inventory. `--check` verifies preconditions; `--recover-offline` restores after an interrupted swap while k3s is stopped. | `dsap-demo-reset.service` (03:00 America/Denver timer). Never run `--execute` directly once the Tailscale gate is installed. |
| `k8s-demo-reset-alert.py` | Sends the reset-failure Discord alert using the webhook stored in the root-only file `/var/lib/dsap-demo/secrets/reset-alert-webhook`. `--test` verifies delivery. | `dsap-demo-reset-alert.service`, triggered on reset failure. |
| `k8s-demo-funnel-gate.py` | Gates Tailscale/Funnel startup on clock synchronization, absence of reset markers, and a successful reset since the latest 03:00 boundary. | Tailscale systemd drop-in (`systemd/tailscaled-demo-gate.conf`). |
| `k8s-demo-ui-prefetch.py` | Validates the public publication manifest (`--check`) and pulls the seven exact image digests into k3s's containerd namespace, staging `pending.json` only after every pull succeeds. Shares the reset lock; refuses to run while reset or recovery markers exist. | `dsap-demo-ui-prefetch.service`/`.timer` (02:30 America/Denver) or manually as root. |
| `k8s-demo-ui-update.py` | Applies staged UI-only image updates through frozen Helm chart packages: `--prepare` freezes charts and inventories, `--check` runs preflight, the reset-service drop-in applies staged digests after a successful reset, `--rollback` restores prior releases after a failure. | `dsap-demo-reset.service` via the `ui-update.conf` drop-in; `--prepare`/`--check`/`--rollback` manually as root. |
| `systemd/` | Unit files: reset service/timer, reset-alert service, Tailscale isolation/alert services, UI-prefetch service/timer, the reset service's `ui-update.conf` drop-in, and the Tailscale gate drop-in. | Installed under `/etc/systemd/system/` on the VM. |

Do not bypass markers, baselines, or gates: an interrupted reset or update
deliberately keeps public access closed until explicit recovery succeeds. See
[demo VM reset](../../docs/operations/demo-vm-reset.md) and
[demo UI publication](../../docs/operations/demo-ui-publication.md).
