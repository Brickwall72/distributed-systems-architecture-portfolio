# Dedicated demo VM data reset

[`scripts/demo-vm/k8s-demo-reset.py`](../../scripts/demo-vm/k8s-demo-reset.py)
is for the dedicated, single-node k3s demo. It restores the five local-path
volume directories from a root-protected, coordinated baseline at
`/var/lib/dsap-demo/baseline`, and verifies the corresponding credential bundle
and Kubernetes inventory. It is not a general Kubernetes backup tool. Keep an
independently stored, encrypted copy of both the baseline and its matching
credentials.

The script requires a loaded k3s systemd drop-in containing:

```ini
[Service]
ExecStartPre=/usr/bin/test ! -e /var/lib/dsap-demo/reset-in-progress
```

With the guard installed, run `sudo python3 scripts/demo-vm/k8s-demo-reset.py
--storage-uuid YOUR_DATA_DISK_UUID --check` to verify its preconditions without
replacing data. A reset stops Traefik and the demo workloads, replaces all five
volumes, then starts the workloads and Traefik. With the Tailscale gate
installed, run resets through `sudo systemctl start dsap-demo-reset.service`,
not by invoking `--execute` directly.
It stages a second copy of the baseline on the data filesystem, so sufficient
free disk space is required. If staging fails, it does not swap the volumes.

An interrupted or failed reset may retain
`/var/lib/dsap-demo/reset-in-progress` and leave a `.dsap-reset-*` directory
on the data filesystem. The k3s guard prevents k3s from starting while that
marker exists. The systemd public gate separately retains
`/var/lib/dsap-demo/public-reset-pending` on failure and stops Tailscale;
private Tailscale access is also unavailable. If systemd cannot stop
Tailscale, the gate cannot guarantee isolation. Independently block public
access and preserve markers, staging directories, logs, and the encrypted
backup for recovery; do not blindly delete markers or retry the normal reset.

## Offline recovery

For offline recovery on this dedicated VM:

1. Disable Funnel or otherwise block external access independently of
   Kubernetes. Preserve the marker and all `.dsap-reset-*` directories.
2. Reboot the VM with the marker in place. The guard must prevent k3s from
   starting. Stop any automatic retries with `sudo systemctl stop k3s.service`;
   do not start k3s or containers manually.
3. Run `sudo python3 scripts/demo-vm/k8s-demo-reset.py --storage-uuid YOUR_DATA_DISK_UUID
   --recover-offline`. This verifies the saved baseline and storage, restores
   all five volumes even if a swap was interrupted, and preserves any existing
   directories in a new staging directory. It leaves the marker in place.
   If it fails, stop and preserve the evidence and backup.
4. Only after offline recovery reports success and external access is blocked,
   an administrator can remove the marker and start k3s. Restore the recorded
   replicas in data, server, client, then Traefik order as needed. Verify
   credentials, readiness and the full demo workflow before exposing it again.
   Keep the old staging directories until recovery has been verified. If the
   public reset marker is also present, keep Tailscale stopped and resolve it
   explicitly after recovery; a gated systemd reset must succeed before
   reopening public access.

A controlled offline-recovery drill and a normal reset have been exercised on
the demo VM; partial-swap recovery has focused local tests, but has not been
simulated on the VM. Offline recovery cannot compare live Kubernetes Secrets or
workloads while k3s is stopped.

## Baseline compatibility

Deployment templates and credentials must remain compatible with the baseline.
Changing only the S3 public endpoint or MinIO CORS origin is permitted; other
template changes require reassessing and recapturing a verified baseline.
Mutable image tags such as `prod` can change image contents without changing a
template and are not detected by this check. Use immutable image references and
revalidate or recapture the baseline for application updates. UI container
images are the one exception, updated through the separate gated procedure in
[demo UI publication](./demo-ui-publication.md).

## Systemd units, alerting, and the Tailscale gate

The dedicated VM's systemd units are in
[scripts/demo-vm/systemd/](../../scripts/demo-vm/systemd/). Install the reset,
public-gate, and alert scripts root-owned under `/usr/local/lib/dsap-demo/`,
and set `DEMO_STORAGE_UUID` in a root-owned `/etc/dsap-demo/reset.env`. The
timer uses 03:00 `America/Denver` and catches up after a missed run. Its
service waits for the Kubernetes API, and invokes the Discord alert service on
failure. Store the Discord webhook URL in the root-only file
`/var/lib/dsap-demo/secrets/reset-alert-webhook`; do not put it in a unit,
command argument, shell history, or source control. Test delivery with
`sudo python3 /usr/local/lib/dsap-demo/k8s-demo-reset-alert.py --test`. Failure
alerts, a systemd-driven reset, and catch-up after a simulated missed run were
tested on the demo VM. Successful resets do not send Discord messages.

The Tailscale drop-in gates startup on clock synchronization, absence of reset
markers, and a successful reset since the latest 03:00 Mountain time boundary.
It preserves daytime changes on an ordinary reboot. The reset service stops
Tailscale before restoring and restarts it only after success, and a separate
failure unit attempts to stop Tailscale if the reset service fails. Do not
manually alter the success timestamp or timer bookkeeping. The VM tests covered
ordinary reboot, a simulated missed run, and a pre-reset failure while Funnel
was off. A successful reset was also tested from outside the tailnet: public
access went offline during the reset and returned afterward. Failure isolation
has not been tested from a public Funnel client.
Run all resets through the service once the gate is installed.

Discord delivery can itself fail; its service logs errors and retries, but is
not an independent guarantee of notification. Check the systemd journal and
timer status. Do not enable Funnel until the gate and direct network exposure
have been independently verified.
