# Temporary Tailscale Funnel smoke test

The disposable dev-machine test uses the Windows Tailscale client to expose
only the app and MinIO S3 API. It does not install Tailscale in WSL, use
`skaffold dev`, expose the MinIO console or NATS monitor, or install DBGate.
Funnel stays off until the chart deployment and Windows-to-WSL port checks
pass.

Create the isolated cluster and initialize its separate demo Secrets:

```bash
pnpm k3d:funnel:smoke up
kubectl --context k3d-dsap-funnel-smoke create namespace platform-funnel-smoke
pnpm k8s:demo-secrets --context k3d-dsap-funnel-smoke \
  --namespace platform-funnel-smoke \
  --dir "$HOME/.local/share/dsap-funnel-smoke" --init
```

Keep the generated bundle protected and reuse it for later runs; omit `--init`
when the bundle already exists. The cluster script binds host ports 8081 and
9000 to loopback only, and the Kubernetes API is bound to loopback port 6445.
If `base-image:local` is missing, build it without running `dev:prepare` (which
also prepares local-development credentials), then build and import the
Skaffold images. This uses Skaffold's image build definitions only; all
deployments are direct Helm installs:

```bash
scripts/dev-env/with-buildkit.sh docker build -f Dockerfile.base -t base-image:local .
pnpm k3d:funnel:smoke images
pnpm k3d:funnel:smoke deploy YOUR_FUNNEL_HOSTNAME
```

Use the hostname shown by Tailscale, without a scheme or port. The deploy
command configures presigned S3 URLs as
`https://YOUR_FUNNEL_HOSTNAME:8443`, restricts MinIO browser CORS to the app
origin, and routes only the S3 API through Traefik's `s3` entry point. Review
pod readiness and the IngressRoutes before continuing:

```bash
kubectl --context k3d-dsap-funnel-smoke -n platform-funnel-smoke get pods
kubectl --context k3d-dsap-funnel-smoke -n platform-funnel-smoke \
  get ingressroutes.traefik.io
```

On Windows, confirm both WSL-published ports are reachable before starting
Funnel:

```powershell
Test-NetConnection 127.0.0.1 -Port 8081
Test-NetConnection 127.0.0.1 -Port 9000
```

Then configure the Windows Tailscale client from PowerShell. These commands
forward public HTTPS 443 to the app and public HTTPS 8443 to the S3 API; they
do not expose an API dashboard or MinIO console:

```powershell
$tailscale = "$env:ProgramFiles\Tailscale\tailscale.exe"
& $tailscale funnel --bg --https=443 http://127.0.0.1:8081
& $tailscale funnel --bg --https=8443 http://127.0.0.1:9000
& $tailscale funnel status
```

From a computer outside the tailnet, open the app and exercise a document
download using a presigned URL. Confirm the URL retains its exact hostname,
`:8443` port, path, and query string. Also check that the Traefik dashboard,
MinIO console, and NATS monitor are not publicly reachable.

If a device already connected to the tailnet cannot open the public URL, check
from a device that is not on the tailnet. Split DNS can resolve the hostname
to its private Tailscale address on tailnet-connected devices; public DNS
records can also take up to 10 minutes to propagate after enabling Funnel.
See [Tailscale's Funnel troubleshooting guidance](https://tailscale.com/docs/features/tailscale-funnel#dns-propagation).

When finished, disable all Funnel listeners and verify they are off:

```powershell
$tailscale = "$env:ProgramFiles\Tailscale\tailscale.exe"
& $tailscale funnel reset
& $tailscale funnel status
```

Then remove only the disposable cluster:

```bash
pnpm k3d:funnel:smoke down
```

Cluster deletion removes its database, object-store, and NATS state. It does
not delete the protected demo Secrets bundle under the home directory, which
can be reused for a repeat test. This smoke test does not configure the later
home-server deployment or provide a database restore point.
