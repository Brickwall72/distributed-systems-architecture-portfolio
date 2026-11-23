# E-sign service

NATS-driven signing worker: validates a signing request, fetches the rendered
draft PDF, applies a cryptographic signature with a PKCS#12 certificate plus
the visual signature block, stores the signed artifact, and returns metadata
with a presigned download URL. It has no user-facing HTTP API — only
`GET /api/v1/health`.

## Responsibilities and data flow

- Serves the sign-document subject over synchronous NATS request/reply for
  [compliance](../../core/compliance-service/README.md). It currently accepts
  only compliance draft keys (`compliance/drafts/{documentId}.pdf`) and
  matching compliance transfer destinations
  (`compliance/transfers/{documentType}`); future domains require their own
  authorized request boundary before being enabled.
- Checks the draft content hash and uses conditional object creation so exact
  retries converge on one stored signed artifact.
- Signing fails rather than returning an unsealed PDF when the certificate or
  cryptographic seal cannot be applied.
- The signing UI lives in the shared UI package and is consumed by compliance
  workflow widgets.

## Certificate and configuration

The server requires a readable P12 certificate at `SIGNING_CERT_PATH` (Compose
mounts `/app/certs/certificate.p12`) and a matching `SIGNING_CERT_PASSWORD`;
the legacy `CERT_PASSPHRASE` variable is accepted if `SIGNING_CERT_PASSWORD`
is unset. The tracked local certificate is for fictional demo data only; the
public demo uses a separately generated certificate (see
[demo secrets](../../../docs/operations/demo-secrets.md)).

Remaining config is Zod-validated in
[`server/src/config.ts`](./server/src/config.ts): `PORT` (default `8080`),
`NATS_URL`, internal and public S3 endpoints, `S3_REGION`, the `dsap` bucket,
and required S3 credentials. Its MinIO identity can read and write the allowed
compliance prefixes but cannot delete objects.

## Local development

Compose service: `esign-server` (internal port `8080`), with a
`compose.dev.yaml` override for `make dev`.

- Workspace: `esign-server`.
- `pnpm --filter esign-server test:unit`. The integration tests verify a real
  PDF signature with a temporary certificate and OpenSSL and exercise the
  responder with separately scoped MinIO accounts; run them only against
  isolated test services through `pnpm test:integration` — see the
  [testing guide](../../../docs/development/testing.md).
