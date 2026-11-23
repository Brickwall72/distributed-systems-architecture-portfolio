# MinIO provisioning

The shared image source, provisioning script, policies, and regression tests
for the platform's object-storage setup. Compose, the integration-test harness,
and Skaffold all build this same source; the MinIO Helm chart only deploys the
resulting `dsap-minio-setup` image.

## What provisioning does

[`files/provision.py`](./files/provision.py) idempotently provisions and
verifies:

- the private `dsap` bucket (no anonymous access);
- per-service MinIO users and scoped policies
  ([compliance](./files/policies/compliance.json),
  [audit](./files/policies/audit.json), and the PDF/e-sign
  [worker](./files/policies/worker.json) identities) covering the
  `compliance/drafts/`, `compliance/transfers/`, and `audit/transfers/`
  prefixes — workers cannot delete objects;
- a `.dsap-ready` marker object under each authorized prefix, which service
  readiness checks wait for;
- a `dsap/.dsap-provision-lock` object that serializes concurrent
  provisioners.

It validates the endpoint, fixed bucket, credential uniqueness, and minimum
secret length, and verifies existing accounts rather than rotating passwords or
silently replacing conflicting policies. Root credentials are available only to
the MinIO server and this setup job; applications use their own
`minio-<service>-credentials`. See
[credentials and resets](../../docs/development/credentials-and-resets.md) for
the account model and lock-recovery guidance.

## Consumers

- **Compose** runs the `minio-setup` service after MinIO is available.
- **Kubernetes** runs it as a Job in the MinIO chart; the Job name includes the
  image settings, resource settings, and release revision so each Helm upgrade
  reruns idempotent provisioning without embedding a second copy of the script
  in the chart. Skaffold builds and supplies the image; a direct Helm
  installation must build or publish it itself and set the MinIO `setupImage`
  and each applicable server's `minioReadiness.image` to the same accessible
  image. Publish changed images under a new immutable tag rather than relying
  on a cached mutable tag.
- **Integration tests** provision the disposable MinIO instance the same way.

## Build and test directly

```bash
scripts/dev-env/with-buildkit.sh docker build \
  -f infrastructure/minio-setup/Dockerfile.setup \
  -t dsap-minio-setup:local infrastructure/minio-setup
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s infrastructure/minio-setup/files -p test_provision.py
```
