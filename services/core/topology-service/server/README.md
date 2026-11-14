<!-- File: services/core/topology-service/server/README.md -->
# Topology server integration tests

Run the complete isolated suite from the workspace root with
`pnpm test:integration`. It starts and cleans up its own Docker dependencies;
normal `pnpm test` does not run integration tests. See the root README for
prerequisites and coverage.

For individual topology tests, use disposable, isolated Neo4j databases with
authentication disabled. The graph tests require `GRAPH_TEST_NEO4J_URI`, claim
and outbox tests require `CLAIM_TEST_NEO4J_URI`, and the seed test requires
`SEED_TEST_NEO4J_URI` pointing to a **separate empty database**. The seed test
leaves seeded data behind. Do not use a development or production database.
