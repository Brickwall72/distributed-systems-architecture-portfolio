# Topology server integration tests

The graph repository integration tests require a **dedicated, empty Neo4j database**
with authentication disabled. They create and remove test data; do not point them
at a development or production database.

Start a disposable Neo4j 5.26 instance, then use its Bolt address:

```sh
GRAPH_TEST_NEO4J_URI=bolt://127.0.0.1:PORT pnpm --filter topology-server test:integration
```

The same environment variable can be used with `pnpm test:integration` at the
workspace root.

The normal `pnpm test` runs unit and contract tests without a database. Stop and
remove the disposable instance after running the integration tests.
