# Testing

## Unit, contract, and verification suites

`pnpm test` runs the workspace unit, contract, and verification suites through
Turbo. Each workspace package defines its own `test:unit`, `test:contract`, and
`test:verify` scripts; run a single package's tests with
`pnpm --filter <package> test:unit`.

## Integration tests

Run `pnpm test:integration` separately from `pnpm test`. It requires Docker
with Compose, pnpm, OpenSSL and curl. The command starts disposable PostgreSQL,
MongoDB, Neo4j, NATS JetStream (including an authenticated broker) and MinIO
containers on dynamically allocated loopback ports after building required
workspace dependencies, runs the integration tests, and removes only its own
project resources. The PostgreSQL and MongoDB tests exercise candidate
restricted runtime roles; the MinIO test exercises candidate domain-scoped
policies and presigned reads. These tests do not configure application
deployments to use those accounts.
It uses a separate empty Neo4j instance for the seed test. Existing development
databases and containers are not used.
CI also runs this isolated suite and the compliance shell integration tests
before publishing demo UI images. These tests do not verify the deployed VM.

The cross-service boundary test uses real PostgreSQL, Neo4j, NATS and the audit
consumer but simulates PDF generation and e-sign responses. The e-sign
integration tests independently verify a real PDF signature with a temporary
certificate and OpenSSL, and exercise the signing responder using separate
scoped MinIO accounts. Run individual tests with explicitly configured,
isolated test services only; never point them at development or production
data.

To check the form signature lines in actual A4 PDFs, run
`pnpm --filter pdf-server exec vitest run src/services/pdfService/templateLayout.integration.test.ts`
with a Puppeteer-compatible Chromium installed.

The harness itself lives in
[scripts/integration/](../../scripts/integration/).

## Script and automation tests

The operational scripts have their own unit tests in
[scripts/tests/](../../scripts/tests/):

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/tests -v
node --test scripts/tests/boundary-calls.test.mjs
```

CI selects which suites run from the changed files: workspace builds and unit
tests use Turbo's affected-package selection; integration suites are selected
from changed workspace packages and their dependents; contract checks run for
service/shared-contract changes and global build inputs. Operations/CI changes
run the automation suite without workspace installation or compilation.
Documentation-only changes skip verification suites.
