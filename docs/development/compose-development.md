# Service-level Compose development

Use Compose when working on individual containers without the Kubernetes
stack. The root Compose file includes the service-owned definitions and does
not bind port `8081`:

```bash
pnpm docker:base
docker compose up --build -d
```

`pnpm docker:base` runs `pnpm dev:prepare` before building. To prepare
credentials without rebuilding the image, run `pnpm dev:prepare`; afterward
plain `docker compose up` is supported. Service `.env` files are the editable
credential source for both Compose and `pnpm k8s:secrets`. Re-run preparation
after editing them. See
[credentials and resets](./credentials-and-resets.md) for how the generated
credentials in `.auth-keys/` work and how to change them safely.

Rebuild the shared base image after changing workspace packages; service image
builds otherwise use the existing `base-image:local` snapshot.

Compose starts an authenticated broker, then services initialize their own
streams and consumers. Existing JetStream data and consumer acknowledgements
are preserved; incompatible subject or consumer configuration fails rather than
being silently replaced.

## Dev overrides for individual services

The root [Makefile](../../Makefile) can start selected services with their
`compose.dev.yaml` overrides:

```bash
make dev svcs=services/platform/esign-service
make dev svcs="ui-shells/global-shell services/platform/esign-service"
```

Use `make logs svc=<service>` to tail a service's logs and `make down` to stop
the stack.

## Published ports

The root Compose deployment exposes the application through Traefik at
`http://localhost/` (port `80`). Client/shell and server containers use
internal ports `3000` and `8080`; access their routes through Traefik rather
than assuming distinct host ports for each application. Other default
published host ports are:

| Component | Host port | Notes |
| --- | --- | --- |
| Traefik dashboard | `8090` | Local development dashboard |
| NATS / monitoring | `4222` / `8222` | Broker and health/monitoring |
| MinIO API / console | `9000` / `9001` | S3 and web console |
| Neo4j browser / Bolt | `7474` / `7687` | Browser port is configurable |
| PostgreSQL / MongoDB | `5432` / `27017` | Database ports are configurable |
| DbGate | `3040` | Database administration UI |

These are defaults from the Compose configuration; service `.env` files may
change database mappings. Inspect the resolved ports with
`docker compose config`. The Kubernetes setup instead exposes Traefik at
`localhost:8081` and does not imply the same host-port mappings.

Stop and remove the Compose containers with:

```bash
docker compose down
```

Do not run the Compose and Skaffold workflows on the same service ports at the
same time.

## MinIO provisioning image

The shared image source, provisioning script, policies, and regression tests
live in [infrastructure/minio-setup](../../infrastructure/minio-setup/),
outside the Helm charts. Compose, integration tests, and Skaffold all build
that same source; the MinIO chart only deploys the resulting image. See its
[README](../../infrastructure/minio-setup/README.md) for details and how to
build and test it directly.

Skaffold builds and supplies the `dsap-minio-setup` image for the MinIO job and
service readiness checks. A direct Helm installation must build or publish that
image itself and set the MinIO `setupImage` and each applicable server's
`minioReadiness.image` to the same accessible image.
