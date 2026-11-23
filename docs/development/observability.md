# Observability

## Correlated diagnostic logs

Servers write JSON lines to stdout. Every HTTP request receives an
`x-correlation-id` response header, including requests rejected by
authentication or validation. Find it in the browser's Network response
headers, or supply an ID when reproducing a request:

```bash
curl -i -H 'x-correlation-id: demo-check-1' http://localhost:8081/compliance/api/v1/health
```

IDs must be a single value of 1-128 ASCII letters, digits, `.`, `_`, `:`, or
`-`. Missing IDs receive a UUID. Invalid or duplicate IDs are replaced, with a
warning that does not record their value. `x-request-id` is accepted only when
`x-correlation-id` is absent, under the same validation rules. IDs are
untrusted diagnostic labels, not authentication or proof that two requests are
related. The application returns its canonical ID; an ingress-generated error
that never reaches a server cannot receive an application-generated header.

The same ID travels through immediate NATS request/reply calls. Meaningful
workflow stages have an `operationId`, optional `parentOperationId`, a `start`
record, and an `end` record with `outcome` and monotonic `durationMs`. For
example, these abbreviated records locate a render failure inside PDF
generation:

```json
{"correlationId":"demo-check-1","operation":"pdf.generate","operationId":"generation-1","phase":"start","level":"INFO"}
{"correlationId":"demo-check-1","operation":"pdf.render","operationId":"render-1","parentOperationId":"generation-1","phase":"start","level":"INFO"}
{"correlationId":"demo-check-1","operation":"pdf.render","operationId":"render-1","parentOperationId":"generation-1","phase":"end","outcome":"failure","durationMs":12,"level":"ERROR"}
{"correlationId":"demo-check-1","operation":"pdf.generate","operationId":"generation-1","phase":"end","outcome":"failure","durationMs":14,"level":"ERROR"}
```

Actual records also include `timestamp`, `subsystem`, and `message`. INFO marks
starts and successful conclusions. Expected rejections, deferred work, aborted
requests, and discarded claims use WARN; unexpected failures use ERROR. HTTP
completion and NATS `reply_received`/`reply_sent` describe transport outcomes,
not proof that a business workflow succeeded. Contract-aware workflow records
distinguish conflicts, pending signing, and actual completion. Successful
health probes and empty worker polls are quiet; their failures remain visible.
A process crash can leave a start without an end.

From the root Compose deployment, search recent container output:

```bash
cid=demo-check-1
docker compose logs --no-log-prefix --no-color --since=15m | grep -F "$cid"
```

For Kubernetes, use `kubectl get pods -A`, then substitute the namespace and
server pod below. Repeat across participating pods; `--previous` retrieves the
previous container's logs when available after a restart.

```bash
kubectl -n NAMESPACE logs SERVER_POD --since=15m | grep -F "$cid"
```

Independently scheduled signing retries, outbox publications, event deliveries,
and rendition attempts receive fresh local contexts. Their existing resource
identifiers can relate attempts, but the original HTTP context is not persisted
across durable workflows or restarts. Stored event correlation IDs are separate
`eventCorrelationId` metadata, not evidence of continuous tracing.

Diagnostic metadata is allowlisted. New boundary/error logs omit raw request
bodies, tokens, cookies, credentials, signatures, PDF/HTML contents, arbitrary
third-party error messages, and presigned URLs. This is not a general redaction
engine for every existing free-form log message. Use fictional demo data and
restrict operator log access.

Operation IDs are not trace/span IDs. Container logs remain available without
Jaeger and are not centralized. Configure log rotation and retention
separately.

## Backend tracing with Jaeger

The six backend servers can export OpenTelemetry spans for HTTP requests,
immediate NATS request/reply calls, and existing workflow stages. Probe
requests are excluded. Jaeger is one private infrastructure workload, not an
app service or a startup dependency. It does not collect logs or traffic
metrics, and it does not trace browser activity or stitch durable retries to
the original request.

For topology graph requests, `topology.graph.project` contains a nested
`topology.graph.neo4j.read` span. The read includes driver connection and
transaction overhead, Neo4j execution, result retrieval, and session cleanup;
use Neo4j `PROFILE` separately to investigate individual Cypher operators.
Neither span records graph contents or filter IDs.

**Compose:** Jaeger and backend tracing are on by default. From the repository
root, start the stack as usual:

```bash
docker compose up --build -d
```

Open [localhost:16686](http://127.0.0.1:16686). Only the UI is published to
loopback; the OTLP receiver stays on the Compose network. Set `JAEGER_UI_PORT`
if that host port is occupied. Compose samples all eligible traces and keeps up
to 5,000 traces in memory; restarting Jaeger discards them. To disable trace
export from the backends without removing Jaeger from the stack:

```bash
DSAP_TRACING_ENABLED=false docker compose up -d
```

**Kubernetes:** Tracing is still opt-in. Refresh the local chart dependencies
with `pnpm charts:deps`, then use `pnpm skaffold -p tracing` for local
development. For a direct Helm rollout, deploy Jaeger in the same namespace as
the servers:

```bash
helm --kube-context "$context" upgrade --install jaeger ./charts/jaeger \
  -n "$namespace" --wait
```

Add `--set global.tracing.enabled=true` to the normal Helm rollout arguments
for `topology-service`, `compliance-service`, `audit-ledger`, `pdf-service`,
`esign-service`, and `auth-service`. Preserve the existing image, credential,
and public endpoint settings. Sampling defaults to 10% of root traces; change
it consistently across the releases with
`--set-string global.tracing.sampleRatio=0.1`. To disable tracing, set
`global.tracing.enabled=false` on those releases. Jaeger has no public ingress
or Funnel route. Use an operator account with namespace-scoped pod port-forward
access:

```bash
kubectl --context "$context" -n "$namespace" port-forward --address 127.0.0.1 svc/jaeger 16686:16686
```

Kubernetes uses a single Jaeger replica with embedded Badger on a retained
5 GiB PVC and a seven-day span TTL. Written traces survive pod replacement,
not loss of the underlying storage. This is not a backup or HA setup. Check
claim capacity with `kubectl -n "$namespace" get pvc jaeger-traces` and actual
usage with your storage provider's volume metrics. Expired spans do not
reclaim disk space immediately, and seven days of traffic may not fit. Lower
the sample rate or expand the claim if the storage class supports expansion.
The chart uses the default storage class unless `storage.storageClassName`
is set.

**Investigating a slowdown:** Find the entry service in Jaeger, filter by
operation and minimum duration, then open a trace. Expand the HTTP and NATS
spans to see how much time went into stages such as `pdf.render` and
`pdf.upload`. Don't add nested or overlapping durations: a parent already
includes time spent waiting on its children. Search the application logs
for the trace ID to find the corresponding start/end records. A trace ID in
the logs doesn't guarantee that Jaeger has it: sampling can miss slow or failed
requests, and an unavailable collector can drop spans. Use `durationMs` in
the logs to compare runs even when traces aren't available.
