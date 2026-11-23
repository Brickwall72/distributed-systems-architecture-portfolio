# Environment setup

## Prerequisites

Install Git and Docker Desktop or Docker Engine first. On Linux or WSL, the
current user must be able to run Docker commands. Docker must be running before
`setup.sh` starts.

Clone the repository and enter the workspace:

```bash
git clone git@github.com:Brickwall72/distributed-systems-architecture-portfolio.git
cd distributed-systems-architecture-portfolio
```

## Bootstrap

Run the bootstrap with Bash. Do not use pnpm before this step; the script
installs pnpm when it is missing:

```bash
BUILD_DOCKER_BASE=true bash setup.sh
```

`setup.sh` installs or verifies Python 3.9 or newer, Node.js, pnpm, kubectl,
Helm, k3d, and Skaffold; installs workspace dependencies; builds the workspace;
and prepares local environment files and credentials. If Python is missing or
too old, it installs Python 3.12 through Homebrew and adds it to your shell
profile. With `BUILD_DOCKER_BASE=true`, it also builds `base-image:local`.
Cluster creation and Traefik installation are separate commands described in
[Kubernetes development](./kubernetes-development.md). The k3d cluster maps
host ports `8081` and `8443` to the Traefik load balancer.

If the script updates your shell profile, reload it before using pnpm in a new
shell:

```bash
source ~/.bashrc  # Linux/WSL
# or: source ~/.zshrc  # macOS
```

## Environment files

The setup script already prepares local environment files after installing
Python and pnpm. To repeat only the non-destructive template merge later, run:

```bash
pnpm env:copy
```

The environment and secret bootstrap scripts require Python 3.9 or newer.
The command creates missing `.env` files and adds variables missing from
existing files. It preserves existing values and local-only variables, and
reports differences from the template by variable name. In particular, changed
template defaults are not automatically applied to existing values; review
those differences after pulling changes. To deliberately replace all local
files with their templates, run `pnpm env:reset` and confirm the warning.
Replacing credentials in `.env` does not update passwords already stored in
persistent databases and can prevent the platform from starting.
The credential helpers accept simple `KEY=value` or fully quoted values; they
reject interpolation and unsupported escaping rather than interpreting a
credential differently from Compose.

If setup reports conflicting MinIO identities after a pull, `env:copy` has
preserved older shared `S3_ACCESS_KEY` or `S3_SECRET_KEY` values. The error
identifies the affected file and variable names without printing their values.
Compare those entries with the adjacent `.env.example` files; the root MinIO
credentials and each service's access key and secret must be distinct.
Back up current credentials and data before changing them. If all existing
local data is disposable, use the explicitly confirmed procedures in
[credentials and resets](./credentials-and-resets.md), then update the
conflicting entries from their templates and rerun `pnpm dev:prepare` or
`bash setup.sh`. If data must be retained, follow the manual credential
recovery/rotation guidance there instead: changing `.env` alone does not
provision accounts or rotate passwords in persistent stores.
