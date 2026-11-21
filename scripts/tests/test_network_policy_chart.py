import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHART = ROOT / "charts" / "network-policies"


@unittest.skipUnless(shutil.which("helm"), "Helm is required")
class NetworkPolicyChartTests(unittest.TestCase):
    def render(self, *values):
        output = subprocess.run(
            ["helm", "template", "network-policies", str(CHART), *values],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        return {
            name: next(
                document for document in output.split("\n---\n")
                if f"  name: {name}\n" in document
            )
            for name in ("allow-traefik-ingress", "allow-minio-storage")
        }

    def test_default_preserves_traefik_namespace_access(self):
        for policy in self.render().values():
            self.assertIn('kubernetes.io/metadata.name: "traefik"', policy)
            self.assertNotIn("app.kubernetes.io/name: traefik", policy)

    def test_k3s_traefik_is_restricted_by_namespace_and_pod_label(self):
        policies = self.render(
            "--set", "traefik.namespace=kube-system",
            "--set", r"traefik.podLabels.app\.kubernetes\.io/name=traefik",
        )
        for policy in policies.values():
            self.assertIn(
                'kubernetes.io/metadata.name: "kube-system"\n'
                "          podSelector:\n"
                "            matchLabels:\n"
                "              app.kubernetes.io/name: traefik",
                policy,
            )


if __name__ == "__main__":
    unittest.main()
