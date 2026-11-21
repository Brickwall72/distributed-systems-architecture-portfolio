import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHART = ROOT / "charts" / "topology-service"


@unittest.skipUnless(shutil.which("helm"), "Helm is required")
class TopologyDemoChartTests(unittest.TestCase):
    def test_demo_database_memory_and_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            charts = Path(directory) / "charts"
            shutil.copytree(ROOT / "charts" / "platform-lib", charts / "platform-lib")
            chart = charts / "topology-service"
            shutil.copytree(CHART, chart, ignore=shutil.ignore_patterns("*.tgz"))
            for dependency in ("client", "server", "database"):
                subprocess.run(
                    ["helm", "dependency", "build", str(chart / "charts" / dependency)],
                    check=True, stdout=subprocess.PIPE, text=True,
                )
            subprocess.run(
                ["helm", "dependency", "build", str(chart)],
                check=True, stdout=subprocess.PIPE, text=True,
            )
            output = subprocess.run(
                ["helm", "template", "topology-service", str(chart),
                 "-f", str(chart / "values-demo.yaml")],
                check=True, stdout=subprocess.PIPE, text=True,
            ).stdout
        deployment = next(
            document for document in output.split("\n---\n")
            if "kind: Deployment\n" in document and "  name: topology-db\n" in document
        )
        for name, value in (
            ("NEO4J_server_memory_heap_initial__size", "256M"),
            ("NEO4J_server_memory_heap_max__size", "512M"),
            ("NEO4J_server_memory_pagecache_size", "256M"),
        ):
            self.assertRegex(deployment, rf"name: {name}\n\s+value: [\"']?{value}[\"']?")
        for key in ("NEO4J_AUTH", "DB_USER", "DB_PASSWORD"):
            self.assertRegex(
                deployment,
                rf"name: {key}\n\s+valueFrom:\n\s+secretKeyRef:"
                rf"\n\s+key: {key}\n\s+name: topology-db-credentials",
            )
        self.assertRegex(deployment, r"limits:\n(?:\s+.*\n)*?\s+memory: 2Gi")


if __name__ == "__main__":
    unittest.main()
