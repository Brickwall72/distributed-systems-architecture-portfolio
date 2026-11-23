# Demo UI publication and gated updates

The demo UI image pipeline publishes digest-pinned UI images from CI and
applies them to the demo VM through a gated, UI-only update procedure. The
scripts live in [scripts/ci/](../../scripts/ci/) (selection, publication, and
browser smoke) and [scripts/demo-vm/](../../scripts/demo-vm/) (prefetch and
gated application).

## CI selection and publication

`scripts/ci/select-demo-ui-images.py BASE TARGET` reports which UI images are
affected between two committed revisions. It treats shared base inputs as
affecting all UI images and ignores documentation-only changes. The companion
`scripts/ci/publish-demo-ui-images.py` builds selected images and produces a
digest-pinned manifest; its first run builds all UI images. After a successful
CI run on `master`, the demo UI publication job can push images to GHCR and
update `demo-ui-images.json` on the `demo-ui-published` branch. Documentation-
only changes preserve the existing image digests. Publishing is gated by the
`DEMO_UI_PUBLISH_ENABLED` repository variable. A disposable loopback-only k3d
browser smoke test is a publication prerequisite. CI selects checks before
building: operations-only and documentation-only changes skip the browser and
publishing jobs when no UI image inputs changed. Smoke scripts and chart
changes still trigger the browser check; backend-only changes use service
integration tests instead. Changes to CI selection or the workflow itself do
not force a browser run. Pull requests compare
against their merge base; pushes compare UI inputs against the last successful
publication, so unpublished UI changes are not lost. The first publication
selects all seven images. Manual `workflow_dispatch` runs the browser check.

The VM can prefetch the manifest and apply staged images through the optional
gated reset procedure below; publication alone does not deploy them. GHCR
packages may need their visibility set to public after initial publication.
Published UI images override the base image's OCI source/revision labels with
this repository and the tested commit. If GHCR denies a push to an existing
package, check that package's **Manage Actions access** grants this repository
Write access; public visibility alone does not grant publishing permission.

CI checks GHCR authorization for all seven UI packages before publication and
on PRs from branches in this repository when UI image inputs changed,
independently of the build/test jobs.
Fork PRs skip this check because it requires a package-write workflow token.
For a quick check without builds, tests, or uploads, manually dispatch the
workflow with `registry_diagnostics_only` enabled. The check requests
`pull,push` authorization and prints only package names and acceptance or HTTP
status, never credentials or registry tokens. Successful authorization does
not prove that a subsequent manifest upload will succeed.

On smoke-test failure, CI prints pod and node status fields before deleting
the disposable cluster. It does not dump Secrets, pod environments, or
application logs; use those status fields to distinguish scheduling,
initialization, and container failures before retrying.
The smoke deployment applies the topology chart's demo values, including
explicit Neo4j heap/page-cache sizes and the demo memory limit.

## Demo UI image prefetch

`scripts/demo-vm/k8s-demo-ui-prefetch.py --check` validates the public
publication manifest without pulling images or writing VM state. Run without
`--check` as root on the dedicated VM to pull all seven exact digests into
k3s's `k8s.io` containerd namespace. It stages
`/var/lib/dsap-demo/ui-updates/pending.json` only after every pull succeeds. A
failed pull retains the prior manifest and reports failure; it never reports a
partial publication as ready.

Install the prefetch script and `publish-demo-ui-images.py` together under
`/usr/local/lib/dsap-demo/`, root-owned. The latter supplies the shared
manifest validator. Prefetch shares the reset lock and refuses to run while
reset or public recovery markers exist. It changes neither workload images,
Helm releases, nor the protected data archive. Cached images are not
deployments.

The optional `dsap-demo-ui-prefetch` systemd service/timer runs at 02:30
`America/Denver`, before the existing 03:00 reset. Keep it disabled until the
manual VM prefetch is verified. Failures are reported in its systemd journal;
this service does not send a reset-failure alert or stop Funnel. Scheduled
application is opt-in: do not install the reset service's `ui-update.conf`
drop-in until the following preflight passes. Pause the nightly timer during
the first controlled gated update, and do not leave scheduled application
enabled unless that test succeeds.

## Gated UI-only updates

The updater deliberately leaves **every original baseline file unchanged**,
including `data.tar.gz`, `deployments.json`, and `SHA256SUMS`. Instead, reset
inventory verification overlays only the seven UI container image references
from a root-owned private `approved-ui-images.json`. This separate approval is
written atomically; all other baseline identity checks still apply. Visitor
data is never recaptured. Keep the original archive and independent backups.

One-time setup:

1. Vendor chart dependencies with `sh scripts/k8s-local/charts-deps.sh`, then
   package the seven releases with
   `helm package charts/<release> --destination <directory>`:
   `audit-ledger`, `auth-service`, `compliance-service`, `compliance-shell`,
   `global-shell`, `topology-service`, and `topology-shell`.
2. Copy the resulting `*-0.1.0.tgz` files to the VM. Install the updater,
   updated reset/gate/prefetch scripts, and publisher together, root-owned,
   under `/usr/local/lib/dsap-demo/`.
3. Run `sudo python3 /usr/local/lib/dsap-demo/k8s-demo-ui-update.py
   --storage-uuid <recorded-uuid> --prepare <chart-directory>`. This freezes
   private chart packages, effective values, and resource inventories. It
   rejects packages whose rendered resources differ from installed releases,
   except UI image references. It makes no Kubernetes changes.
4. Run the same command with `--check` instead of `--prepare ...`.
   Preflight verifies the baseline, live configuration, cached digests, chart
   checksums, and server-side rendering of every candidate release. Any
   non-image change—including provisioning Jobs, storage, Secrets, backends,
   or ingress—blocks the update. A chart version number alone is not approval.
5. Only after preflight passes, install
   `scripts/demo-vm/systemd/dsap-demo-reset.service.d/ui-update.conf` as
   `/etc/systemd/system/dsap-demo-reset.service.d/ui-update.conf`, reload
   systemd, and run one controlled reset through `dsap-demo-reset.service`.
   Verify its result before enabling the optional prefetch timer.

The drop-in applies staged digests after the original data reset succeeds and
before Funnel reopens. Helm upgrades reuse installed values, disable hooks,
wait for readiness, and preserve release history. The updater then checks the
protected baseline and live inventory and fetches the global HTML page and all
six federation JavaScript entries over loopback. HTML fallback pages cannot
satisfy the JavaScript checks. Already-approved digests do not create new Helm
revisions. Later publications update only images, not the frozen charts.

Before any Helm change, the updater durably records prior release revisions
and the previous image approval in `ui-update-in-progress`. Failures attempt
rollback but **retain that marker and keep public access closed**, even after
a successful automatic rollback. Interruption or reboot also prevents Funnel
startup and further resets. With k3s running and the public gate still closed,
run the updater with `--rollback` to restore and verify all prior releases and
approval state. Only this explicit successful recovery clears the UI marker;
it does not reopen Funnel. Inspect reset state before explicitly completing
the existing public-gate recovery procedure. Never manually delete markers
or change baseline checksums to bypass a failed check.

The drop-in extends the service timeout to 90 minutes to cover reset, seven
three-minute Helm waits, and rollback. Failure uses the reset service's
existing isolation and Discord alert units. Keep this integration disabled
until tested on the dedicated VM; local tests are not a live recovery test.

## Verification status

The dedicated VM's successful-update path was verified through its actual
reset timer using a temporary 30-second runtime override: baseline restoration,
all seven Helm upgrades, and post-update baseline/inventory/HTTP checks passed.
The original 03:00 Mountain schedule and `Persistent=true` were restored.
The actual prefetch timer was also verified with a temporary runtime override;
all seven images were staged successfully without changing deployments. Its
02:30 Mountain schedule was then restored and enabled. Both timers' enabled
states, persistence, service targets, and exact next-run times were verified.
The public demo, a federation entry, and MinIO's HTTPS health endpoint returned
HTTP 200 afterward. UI-update interruption and rollback have not yet been
tested on the VM; the local rollback tests do not establish live recovery.

Do not enable a timer or Funnel until a full restore and recovery have been
tested and failure notification and missed-run behavior have been decided.
