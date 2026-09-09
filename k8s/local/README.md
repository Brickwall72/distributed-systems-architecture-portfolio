# Local Kubernetes

The local manifests target the `platform-local` namespace. Run `pnpm k3d:up`, then `pnpm skaffold`; the Skaffold script creates or updates the ignored local Neo4j Secret before deployment.

To provide a repeatable credential explicitly, run:

```bash
DB_PASSWORD='your-local-value' pnpm k8s:secrets
```

The default Kubernetes Neo4j deployment has no volume and is disposable when its pod or cluster is deleted. Compose currently owns its separate named volume; remove that volume only when intentionally resetting Compose graph data.

Neo4j keeps its official startup ownership repair behavior in local Kubernetes;
the application workloads use the stricter non-root and capability-drop policy.
