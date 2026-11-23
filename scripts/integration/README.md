# Integration-test harness

Isolated cross-service integration testing with disposable backing services.
Runs on a developer machine and in CI; it never uses existing development
databases or containers. See the
[integration-testing guide](../../docs/development/testing.md).

| Script | Responsibility | Invoked by / when |
| --- | --- | --- |
| `test-integration.sh` | Builds required workspace dependencies, starts disposable PostgreSQL, MongoDB, Neo4j, authenticated NATS JetStream, and MinIO containers on dynamically allocated loopback ports, runs the integration suites, and removes only its own project resources. | `pnpm test:integration`; also run by CI before demo UI publication. |
| `integration-compose.yaml` | Compose definition for the disposable backing services used by `test-integration.sh`. | Not used directly; consumed by `test-integration.sh`. |
| `test-audit-mongo-authorization.js` | `mongosh` script executed inside the disposable MongoDB container to verify the audit application account's restricted (append-only) authorization. | Executed by `test-integration.sh`. |
