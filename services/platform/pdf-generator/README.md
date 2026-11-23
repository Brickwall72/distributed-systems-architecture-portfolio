# PDF generator

NATS-driven rendering worker: renders transfer document HTML to PDF with
Chromium, stores the result in object storage, and returns metadata plus a
time-limited presigned download URL. It has no user-facing HTTP API — only
`GET /api/v1/health`.

## Responsibilities and data flow

- Serves two separate synchronous NATS request/reply subjects:
  `GENERATE_PDF` for [compliance](../../core/compliance-service/README.md)
  draft documents and `GENERATE_AUDIT_PDF` for
  [audit ledger](../../core/audit-ledger/README.md) overview renditions.
- Enforces strict destination checks per subject: compliance requests may only
  target `compliance/drafts` keys and audit requests only
  `audit/transfers/{id}/overview-v{n}` keys. Each caller's NATS permissions
  allow only its own subject, so the broker policy, PDF worker, and both
  callers must be deployed together.
- Multi-page transfer forms place their signing block on a final page, where
  [e-sign](../esign-service/README.md) later applies the visual signature and
  date.
- Stores rendered PDFs in the `dsap` bucket and signs download URLs against
  the browser-reachable `S3_PUBLIC_ENDPOINT`.

## Configuration

Config is Zod-validated in [`server/src/config.ts`](./server/src/config.ts):
`PORT` (default `8080`), `NATS_URL`, internal and public S3 endpoints (defaults
`http://minio:9000` / `http://localhost:9000`), `S3_REGION` (`us-east-1`), the
`dsap` bucket, and required S3 credentials. Its MinIO identity can read and
write the allowed compliance and audit prefixes but cannot delete objects.

## Local development

Compose service: `pdf-server` (internal port `8080`). The image includes
Chromium and is intentionally large; Skaffold imports can take a while.

- Workspace: `pdf-server` (no client package).
- `pnpm --filter pdf-server test:unit`. To check the form signature lines in
  actual A4 PDFs, run
  `pnpm --filter pdf-server exec vitest run src/services/pdfService/templateLayout.integration.test.ts`
  with a Puppeteer-compatible Chromium installed.
