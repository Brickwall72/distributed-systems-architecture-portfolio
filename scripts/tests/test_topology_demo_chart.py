import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHART = ROOT / "charts" / "topology-service"


class SmokeDemoValuesTests(unittest.TestCase):
    def test_smoke_deployment_applies_demo_database_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "helm-calls"
            for name in ("helm", "kubectl", "k3d"):
                tool = root / name
                tool.write_text(
                    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HELM_TEST_LOG"\n'
                    if name == "helm" else "#!/bin/sh\nexit 0\n"
                )
                tool.chmod(0o755)
            subprocess.run(
                ["bash", str(ROOT / "scripts/k3d-funnel-smoke.sh"), "deploy-loopback"],
                check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                env={**os.environ, "PATH": f"{root}:{os.environ['PATH']}", "HELM_TEST_LOG": str(log)},
            )
            deployment = next(line for line in log.read_text().splitlines()
                              if "upgrade --install topology-service " in line)
            self.assertIn("-f charts/topology-service/values-demo.yaml", deployment)


@unittest.skipUnless(shutil.which("helm"), "Helm is required")
class TopologyDemoChartTests(unittest.TestCase):
    def test_ui_images_support_digests_and_keep_tag_defaults(self):
        digest = "sha256:" + "a" * 64
        with tempfile.TemporaryDirectory() as directory:
            charts = Path(directory) / "charts"
            shutil.copytree(ROOT / "charts" / "platform-lib", charts / "platform-lib")
            for name, dependency, image in (
                ("topology-service", "client", "topology-client"),
                ("topology-shell", "shell", "topology-shell"),
            ):
                with self.subTest(chart=name):
                    chart = charts / name
                    shutil.copytree(ROOT / "charts" / name, chart, ignore=shutil.ignore_patterns("*.tgz"))
                    for child in (chart / "charts").iterdir():
                        if child.is_dir() and (child / "Chart.yaml").is_file():
                            subprocess.run(
                                ["helm", "dependency", "build", str(child)],
                                check=True, stdout=subprocess.PIPE, text=True,
                            )
                    subprocess.run(
                        ["helm", "dependency", "build", str(chart)],
                        check=True, stdout=subprocess.PIPE, text=True,
                    )
                    def render(*args):
                        return subprocess.run(
                            ["helm", "template", name, str(chart), *args],
                            check=True, stdout=subprocess.PIPE, text=True,
                        ).stdout
                    self.assertIn(f'image: "{image}:prod"', render())
                    self.assertIn(
                        f'image: "{image}@{digest}"',
                        render("--set-string", f"{dependency}.image.digest={digest}"),
                    )

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
