# platform-lib (library Helm chart)

This library chart provides reusable Deployment + Service templates for four
workload kinds, each `include`d directly by a consuming chart's own template
file (e.g. `{{ include "platform-lib.server" . }}`):

- **server** — backend microservice (HTTP, port 8080)
- **client** — micro-frontend / static client (HTTP, port 3000)
- **shell** — micro-frontend host (HTTP, port 3000)
- **database** — stateful backing service (TCP, port 5432)

## Key design decision: consuming chart values are the source of truth

Because `include` renders in the caller's own context, this library chart's
own `values.yaml` is **never merged in automatically**. Every consuming chart
(e.g. `charts/esign-service/charts/server`) must supply the following flat
shape directly in its own `values.yaml`:

```yaml
# example values for a chart that includes platform-lib.server
image:
  repository: ghcr.io/your-org/topology-service
  tag: v0.1.0
  pullPolicy: IfNotPresent

replicas: 1

env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: topology-db-creds
        key: DATABASE_URL
envFrom:
  - secretRef:
      name: topology-prod-secrets

annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: "/metrics"

probes:
  readiness:
    httpGet:
      path: /api/v1/health
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 10
  liveness:
    httpGet:
      path: /api/v1/health
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 10

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

`database` uses the same shape but with fixed TCP probes (not configurable),
`replicas` is not applicable (always 1), and it additionally needs:

```yaml
persistence:
  enabled: true
  size: 1Gi
  mountPath: /var/lib/postgresql/data
```

