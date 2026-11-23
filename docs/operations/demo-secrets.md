# Public-demo secrets

The public demo intentionally permits selection of fictional identities. Its
secrets are separate from local `.env` files, the tracked local signing
certificate, and local Kubernetes Secrets. For the home server, create a
dedicated namespace, then explicitly initialize its material:

```bash
kubectl --context YOUR_CONTEXT create namespace platform-demo
pnpm k8s:demo-secrets --context YOUR_CONTEXT --namespace platform-demo \
  --dir "$HOME/.local/share/dsap-demo" --init
```

The command generates high-entropy credentials, JWT keys, and a separate
self-signed fictional signing certificate. It stores a mode-0600 bundle in the
private directory and creates Kubernetes Secrets without putting their values
in Helm settings or command arguments. Keep a protected backup of the bundle:
it is required for repeat provisioning and recovery. Later runs use the same
arguments (without `--init` is sufficient); existing Secrets are compared, not
replaced. The bundle is bound to the named Kubernetes context and namespace.
If material, an existing Secret, or persistent state conflicts, stop and
recover the original material rather than generating replacements. The
certificate is for a fictional demo, not a trusted real-world signature.

When provisioning from a deployment copy without the tracked local signing
certificate, provide its SHA-256 fingerprint as a single hexadecimal digest in
`services/platform/esign-service/server/certs/certificate.p12.sha256` relative
to the copied scripts' repository layout. Generate it from the actual local
certificate using `sha256sum`; the check fails if neither the certificate nor a
valid fingerprint is present. Protect the fingerprint from modification and
update it if the tracked certificate changes.

This command provisions **secrets only**. It does not configure Funnel, install
application releases, deploy DBGate, secure the Kubernetes API or dashboards,
or enable TLS. A demo deployment must omit DBGate and other admin
surfaces, configure its own namespace-aware NATS and browser-reachable S3
endpoints, and verify network policy enforcement. Kubernetes Secrets also
require appropriate RBAC, encryption at rest, and protected host and backup
access. Intentional rotation requires coordinated updates to the
backing service, clients, and any restore procedure; changing a Secret alone
does not rotate a persisted database account. A demo data reset must not
replace current credentials.

## Access-model upgrade for version-1 bundles

For a version-1 demo bundle, an explicit access-model upgrade preserves the
existing administrator, JWT, NATS and signing material and writes a protected
`demo-secrets-v1.backup.json`. The upgrade is resumable after an interruption:

```bash
pnpm k8s:demo-secrets --context YOUR_CONTEXT --namespace platform-demo \
  --dir "$HOME/.local/share/dsap-demo" --upgrade-access-model
```

The upgrade refuses to proceed if the database or MinIO deployments or PVCs,
or dependent service deployments, exist. It does not migrate live database
objects or delete storage. Preserve data and arrange an explicit migration or
recovery before upgrading an already deployed demo. Inspect and retain the
backup and any staged upgrade file; never generate replacement credentials to
recover an existing deployment.

## Public-exposure chart settings

The Helm chart defaults keep DBGate disabled and disable the MinIO and NATS
management ingress routes. The local Skaffold workflow explicitly enables those
local routes and DBGate for development. The public-safe Traefik values do not
expose its dashboard; `pnpm helm` deliberately uses the separate
`charts/traefik-values-local.yaml` for the local development dashboard. A
public deployment must explicitly configure only the application and
browser-facing S3 routes it needs; do not use the local Traefik values file.

The network policy chart defaults to allowing ingress from the `traefik`
namespace. If using the k3s-managed Traefik in `kube-system`, configure both
`traefik.namespace=kube-system` and `traefik.podLabels` to match the actual
Traefik pod labels; otherwise the policy either blocks Traefik or admits more
pods than intended. Verify enforcement and both application and S3 traffic.
This setting does not configure Traefik, TLS, or external access.

For the demo VM, `charts/topology-service/values-demo.yaml` sets explicit Neo4j
heap and page-cache sizes and a 2 GiB container memory limit. Include this file
in topology Helm installs and upgrades; it also gives the authenticated Neo4j
readiness check more time and runs it less often on the demo VM. Adjust the
values for the available resources and workload. The file preserves the
existing database Secret references and does not change persistent storage.
