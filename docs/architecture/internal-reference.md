# Internal dependency and connection reference

CI tests and generates the reports on pull requests, pushes, and normal manual
runs; the generated bundle is available as a workflow artifact. After a
successful verification and generation on a `master` push, CI opens or updates
a pull request when committed reports differ. Merge that pull request to
update the files served by GitHub Pages; generation alone does not publish
them. GitHub Actions must be allowed to create pull requests in the repository
settings, and branch protection still applies. Registry-diagnostics-only runs
skip report generation. Demo UI publication does not wait for these reports.

The [published HTML report](https://brickwall72.github.io/distributed-systems-architecture-portfolio/generated/dependencies/dependencies.html)
links source locations to `master`. Source line numbers can drift after changes
until the generated-report pull request is merged.

The [internal reference](../generated/dependencies/index.md) replaces the
external-library SBOM. It lists first-party workspaces, contracts, managed
storage, widgets, and shell pages; the [HTML view](../generated/dependencies/dependencies.html)
provides per-segment boundary-call tables, while the
[JSON graph](../generated/dependencies/dependencies.json) is machine-readable.
The [architecture overview](../generated/architecture/architecture.md)
shows the larger service connections.

Workspace links come from package manifests, and federation composition and
connection-boundary functions are extracted from tracked runtime source using a
TypeScript/TSX-capable parser. Each supported boundary identifies its enclosing
function/method, call, source location, and immediate caller/wrapper
where resolvable. Runtime storage and service relationships use the existing
[architecture model](./model.json); keep that model current
when those relationships change.

Dependencies point **consumer -> provider**; possible change impact follows the
reverse direction. A database/server implementation change does not necessarily
break every client. A shared API/event schema change may affect other services;
matching resolved subjects (including supported NATS wildcards), not merely
using the same NATS broker, establish automatic event-payload links. Declared
model edges are distinguished from source-verified evidence. Call tables
distinguish direct boundaries from local wrappers used to resolve connection
subjects.

This is static reference documentation, not a complete runtime call graph,
compatibility verdict, vulnerability scan, or CI test-selection engine.
Unresolved dynamic destinations and unsupported connection patterns are shown
as explicit coverage gaps. Actual credentials, environment values, and signed
document URLs are not included.

To regenerate after installing workspace dependencies:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm docs:generate
```

Generation requires Git, Python 3, and Node with the declared parser
dependencies; it does not build images, start services, scan containers, or
download tooling. The generators live in
[scripts/docs/](../../scripts/docs/). To test them directly:

```bash
python3 -m unittest scripts.tests.test_documentation_reports -v
node --test scripts/tests/boundary-calls.test.mjs
```
