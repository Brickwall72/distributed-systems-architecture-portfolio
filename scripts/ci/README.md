# CI pipeline scripts

Change selection, demo UI image publication, and the disposable browser smoke
test. These run in GitHub Actions ([ci.yaml](../../.github/workflows/ci.yaml));
`publish-demo-ui-images.py` is additionally installed on the demo VM because
the demo-vm scripts reuse its manifest validator. See the
[demo UI publication guide](../../docs/operations/demo-ui-publication.md) for
the end-to-end pipeline.

| Script | Responsibility | Invoked by / when |
| --- | --- | --- |
| `select-demo-ui-images.py BASE TARGET` | Reports which UI images and verification suites are affected between two committed revisions. Treats shared base inputs as affecting all UI images and classifies operations-only and documentation-only changes so CI can skip expensive jobs. | CI change-selection step; can be run locally for a dry read. |
| `publish-demo-ui-images.py` | Builds the selected UI images and produces a digest-pinned publication manifest; `--check-registry-access` verifies GHCR `pull,push` authorization for all seven UI packages without building. The demo VM imports its manifest validator. | CI publication and registry-diagnostics jobs; installed root-owned on the demo VM alongside the `demo-vm/` scripts. |
| `publish-demo-ui-release.sh` | CI wrapper: after a successful `master` run, pushes images to GHCR and updates `demo-ui-images.json` on the `demo-ui-published` branch. Gated by the `DEMO_UI_PUBLISH_ENABLED` repository variable. | CI demo UI publication job only. |
| `ci-demo-ui-browser-smoke.sh` | Creates a disposable loopback-only k3d cluster (via `scripts/k8s-local/k3d-funnel-smoke.sh`), deploys the charts with demo values, runs the browser smoke test, and cleans up only resources it created. | CI browser smoke job; a publication prerequisite. |
| `demo-ui-browser-smoke.mjs` | Puppeteer-driven browser check of the deployed global shell and federated entries; requires `--confirm-disposable-k3d`. | Invoked by `ci-demo-ui-browser-smoke.sh`. |
