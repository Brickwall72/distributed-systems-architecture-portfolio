# Integrated Kubernetes development

The integrated development workflow uses Docker, k3d, Kubernetes, Helm
(Traefik, `traefik-shared`, and every service/shell chart under `charts/`), and
Skaffold. Traefik is exposed through the k3d load balancer at
`http://localhost:8081`; no manual `kubectl port-forward` is required.

## Start the local platform

Run these steps in order from a freshly bootstrapped workspace (see
[setup](./setup.md)).

Select or create the k3d cluster:

```bash
pnpm k3d:up
```

Ensure Traefik and the shared Traefik middlewares are installed:

```bash
pnpm helm
```

Vendor `platform-lib` into every service/shell chart's `charts/` directory. Run
this once after clone and again whenever `charts/platform-lib` or any chart's
`Chart.yaml` dependencies change:

```bash
pnpm charts:deps
```

Create the Kubernetes database credentials while the cluster API is available:

```bash
pnpm k8s:secrets
```

The helper operates only on context `k3d-platform-cluster` and the
`platform-local` namespace. It prepares credentials from the service `.env`
files and requires all relevant values to be present. If a database Secret does
not exist and its storage is new, it uses those credentials. On subsequent runs
it checks the existing Secrets rather than overwriting them. It refuses
conflicting local values or missing credentials alongside existing storage or
workloads; recover the original credentials before retrying instead of deleting
data. NATS and auth key files must match any existing Kubernetes Secrets.

Start the integrated development deployment and leave it running:

```bash
pnpm skaffold
```

For a complete rebuild without cached artifacts, stop the current Skaffold
process first, then run:

```bash
pnpm skaffold:reset
```

## Verifying the deployment

After the ordered startup steps above, open the application at
[http://localhost:8081](http://localhost:8081). Useful checks are:

```bash
kubectl config current-context
kubectl get pods,svc,ingress -A
curl -i http://localhost:8081/
curl -i http://localhost:8081/topology/client/remoteEntry.js
curl -i http://localhost:8081/compliance/client/remoteEntry.js
curl -i http://localhost:8081/topology/api/v1/health
curl -i http://localhost:8081/pdf/api/v1/health
```

The expected Kubernetes context is `k3d-platform-cluster`. The browser reaches
the application and APIs through Traefik on `localhost:8081`. The charts use
port `3000` for client/shell containers and `8080` for server containers;
these are internal ports, not separately published host ports.

## Browser-reachable object storage

PDF presigned URLs use `http://minio.localhost:8081`, routed to the MinIO S3
API Service on port `9000` (not the web console on port `9001`). The MinIO API
allows browser CORS for this local workflow; a successful presigned download
should return `Content-Type: application/pdf`.

The compliance document viewer also signs download URLs. The compliance server
uses `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`:
Compose reads them from the compliance service environment, while the Helm
chart reads credentials from `minio-compliance-credentials`. Set the public endpoint to
the exact browser-reachable S3 origin before deployment; `minio.localhost`
works only on the local machine. Remote deployments need an HTTPS endpoint,
compatible S3 ingress and CORS permitting the frontend origin; rewriting a URL
after signing invalidates its signature. Configure the same browser-reachable
`S3_PUBLIC_ENDPOINT` for the PDF and e-sign services, which also issue URLs.

## Workflow semantics to expect

Compliance drafts use topology-owned organization and asset facts, and signing
uses topology-owned reservations and atomic custody transitions. Draft
validation and authorization/receipt reservations use synchronous NATS
request/reply. After e-signing, compliance saves the document and durable event
intents before returning the PDF; topology applies the reserved transition
asynchronously. The workflow and document table show pending, applied, or
attention-required synchronization. A pending update needs attention after five
minutes or when publication fails; the status clears when recovery completes.
Signing is durable and may continue after a timeout; retry the identical
request rather than creating a replacement signature. An unresolved signing
operation retains its signature image in the compliance database until
completion or a pre-signing conflict. Restrict database access, encrypt
backups, and monitor retry failures; never discard an uncertain operation or
release its signing claim without first reconciling the signed artifact and
topology state. See the
[compliance service README](../../services/core/compliance-service/README.md)
for recovery queries.

Fresh topology graphs start with fictional organizations and at least twelve
available assets, but no transfer history. The seed runs only when no topology
entities exist, so it does not replace existing graphs or recreate custody
relationships on restart. New transfers must be created through the normal
workflow.

## Persistence and upgrade safety

The topology Kubernetes chart uses a PVC for Neo4j data. An upgrade from a
running non-persistent topology deployment is blocked by default because
switching volumes would replace its currently visible graph with a different
one. Back up or deliberately discard that graph before enabling the explicit
Helm override `database.persistence.allowStorageTransition=true`. The override
does not migrate data. The Neo4j deployment uses the Recreate strategy to avoid
concurrent writers to the PVC, so upgrades and restarts cause brief downtime.
Compose already uses a named volume.

The Helm charts retain database, MinIO, NATS and DBGate PVCs when a release is
uninstalled, including Skaffold cleanup. Their contents and credentials remain
the operator's responsibility; deleting a namespace, PVC, backing volume, or
cluster is a separate destructive operation and is not prevented by Helm's
retention annotation. Reinstall the same releases against the retained claims
and original Secrets, or deliberately remove the claims only after a backup and
an explicit decision to discard their contents.

## Service configuration notes

Neo4j Community Edition does not provide the fine-grained role commands needed
to enforce graph permissions per demo profile. The topology service connects
using its database credentials and enforces profile and organization access at
the application boundary; signing into the UI does not create a database user.
Topology validates `PORT` (default `8080`), `NATS_URL` (default
`nats://localhost:4222`), and `NODE_ENV` (default `development`) through its
[server configuration](../../services/core/topology-service/server/src/config.ts).
If changing `PORT`, also align the container port mappings and health probes.

The e-sign service requires a readable P12 certificate and a matching
`SIGNING_CERT_PASSWORD`; signing fails rather than returning an unsealed PDF
when the certificate or cryptographic seal cannot be applied. The legacy
`CERT_PASSPHRASE` variable is accepted if `SIGNING_CERT_PASSWORD` is unset.

Demo login also allows callers to select any seeded identity. Compose and Helm
configure the `dsap` bucket without anonymous access, but a presigned URL can
be used by anyone holding it until it expires. Use fictional data only; this
development configuration does not protect sensitive documents.

## NATS identities and streams

NATS uses per-service identities, subject permissions, and private reply
inboxes. Topology and compliance create or verify their own event streams;
subscribers create or verify their own durable consumers. Permissions authorize
those specific JetStream operations rather than granting unrestricted
administration. PDF generation uses separate NATS subjects for compliance
drafts and audit overviews; each caller is permitted only its own subject, and
the PDF service rejects keys outside the subject's domain prefix. Deploy the
broker policy, PDF worker, and both callers together: older audit clients still
using the compliance subject will be denied. E-sign currently accepts only
compliance draft keys and matching compliance transfer destinations; future
domains require their own authorized request boundary before being enabled.

Publishers initialize their streams before publishing; subscribers wait for
upstream streams and remain unready until their durable consumers are
available. Retained stream events are available to a newly created consumer,
subject to JetStream retention limits. Events published before a stream exists
cannot be retained by that stream; the transfer outboxes retry publication on
failure. NATS permissions are subject-based: authorizing a service to create
its own stream or consumer is not a general validation of every field in its
request. Contracts and service validation remain necessary.

The local broker connections are plaintext and the local credentials are not a
production secret-management solution. Use TLS, network isolation and managed
secret rotation for a real deployment.

Do not run the Compose and Skaffold workflows on the same service ports at the
same time. Tear the workflow down in the order described in
[cleanup and storage](./cleanup-and-storage.md).
