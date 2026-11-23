# Scripts

Operational scripts, grouped by concern. Each group has its own README
describing what each script is responsible for, where it runs, and when.

| Group | Concern | Runs on |
| --- | --- | --- |
| [dev-env/](./dev-env/) | Local environment bootstrap: `.env` merging, credentials, keys, build wrappers | Developer machine |
| [k8s-local/](./k8s-local/) | Local k3d/Kubernetes cluster lifecycle, chart vendoring, local Secrets | Developer machine |
| [integration/](./integration/) | Isolated integration-test harness with disposable backing services | Developer machine and CI |
| [ci/](./ci/) | CI change selection, demo UI image publication, browser smoke test | GitHub Actions (publisher also installed on the demo VM) |
| [demo-vm/](./demo-vm/) | Dedicated demo VM: secrets, nightly reset, gated UI updates, systemd units | Demo VM (root) |
| [docs/](./docs/) | Generated documentation reports (architecture, dependency reference) | Developer machine and CI |
| [tests/](./tests/) | Unit tests for the scripts above | Developer machine and CI |

Most developer-facing scripts are wired to `pnpm` commands in the root
[package.json](../package.json); prefer those entry points over invoking the
scripts directly. See the [development guide](../docs/development/) for the
workflows that use them.
