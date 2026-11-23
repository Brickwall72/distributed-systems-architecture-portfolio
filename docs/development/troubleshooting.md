# Troubleshooting

**Docker daemon unavailable:** Run `docker info`. Start Docker Desktop or the
Docker Engine and rerun `./setup.sh`.

**Port `8081` is already in use:** Find the owning process with
`ss -ltnp | grep ':8081'` on Linux/WSL. Stop the conflicting process or
container before running `pnpm k3d:up`.

**Wrong Kubernetes context:** Run `pnpm k3d:up`; it creates the named cluster
when absent and selects `k3d-platform-cluster`.

**Traefik returns `404`:** A `404` from `localhost:8081` before Skaffold
deploys application Ingress resources confirms that Traefik is reachable. Start
`pnpm skaffold` and inspect `kubectl get ingress -A`.

**Skaffold appears stuck loading images:** The PDF server image contains
Chromium and can take a while to import into k3d. Check `docker ps`, wait for
the import to finish, and avoid interrupting it unless the process is genuinely
stalled.

**Servers wait for MinIO accounts and topology health returns `404`:** Inspect
the MinIO setup Job and the servers' `wait-for-minio-account` logs. Network
policies must allow compliance, audit, PDF and e-sign pods to reach MinIO on
TCP port 9000 in both directions (client egress and MinIO ingress).
Init containers use their parent pod's network identity. A successful setup Job
does not prove application pods can connect. Topology does not expose its ready
health route until its compliance-stream consumer initializes, so a topology
readiness failure can be a downstream symptom of compliance failing to start.
Do not bypass readiness or reset credentials to fix a connectivity failure.

**MinIO setup reports `UnboundLocalError` in `provision_ready_markers`:**
Rebuild the setup image with `docker compose up --build -d`. The
readiness-marker fix binds the HTTP response before consuming it. Existing
accounts, bucket contents, and matching readiness markers can be reused; no
volume reset is required.

**Skaffold cannot find `base-image:local`:** Run `pnpm docker:base`;
`pnpm skaffold` and `pnpm skaffold:reset` perform this base build
automatically.

The Docker and Skaffold scripts verify Docker BuildKit/buildx before building.

**Benign pnpm `ENOENT` warnings:** `pnpm setup` can emit symlink warnings in
WSL or minimal Linux environments. Confirm that `pnpm --version` works in a new
shell; rerun setup only if pnpm is unavailable.
