# Local environment scripts

Bootstrap and maintain the local development environment: environment files,
generated credentials, signing keys, and build preconditions. These run on a
developer machine, usually through `pnpm` commands; `setup.sh` at the
repository root drives the initial bootstrap.

| Script | Responsibility | Invoked by / when |
| --- | --- | --- |
| `copy-env.py` | Merges `.env.example` templates into `.env` files. Creates missing files, adds missing variables, preserves existing values, and reports differences from the template. `--reset` deliberately replaces local files with their templates after confirmation. | `pnpm env:copy` / `pnpm env:reset`; part of `pnpm dev:prepare` and `setup.sh`. Run after pulling template changes. |
| `prepare-local-compose.py` | Prepares per-workload generated credentials under `.auth-keys/local/` (an atomically published generation) from the service `.env` files. Rejects conflicting MinIO identities and interpolated values. `--accept-provisioned-credentials` publishes deliberately changed credentials after the backing accounts were rotated out-of-band; it refuses running Compose containers. | `pnpm dev:credentials`; part of `pnpm dev:prepare`. Run after editing service `.env` files. |
| `reset-local-compose.py` | Previews and (with `--execute` and a typed confirmation) deletes a disposable local Compose project's containers and named volumes. Refuses unexpected projects, foreign workspaces, and unverifiable volumes. Never touches Kubernetes. | `pnpm dev:reset:compose --project <name>`; only when local Compose data is disposable. |
| `generate-auth-keys.sh` | Generates the local JWT signing keypair in `.auth-keys/` (gitignored) for the auth service and verifying servers. | Part of `pnpm dev:prepare`; `scripts/k8s-local/k8s-local-secrets.py` also invokes it when keys are missing. |
| `generate-nats-credentials.sh` | Generates per-service NATS passwords in `.auth-keys/nats/`. Partial material is rejected rather than silently replaced. | Part of `pnpm dev:prepare`; also invoked by `k8s-local-secrets.py`. |
| `ensure-python.sh` | Installs or verifies Python 3.9+ (via Homebrew when missing) and updates the shell profile. | Sourced by `setup.sh` during bootstrap. |
| `with-buildkit.sh` | Wrapper that verifies the Docker daemon and buildx are available and exports BuildKit variables before running a build command. | `pnpm docker:base`, `pnpm skaffold`, the funnel smoke scripts, and any manual `docker build`/`skaffold` invocation. |

Credentials written under `.auth-keys/` are private to the host user and must
never be committed. Changing a value in `.env` does not rotate passwords
already stored in persistent databases; see
[credentials and resets](../../docs/development/credentials-and-resets.md).
