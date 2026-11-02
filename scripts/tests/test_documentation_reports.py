import json
import tempfile
import unittest
from pathlib import Path

from scripts import generate_architecture, generate_sbom_reports, sync_generated_reports


APPLICATION_IMAGES = [
    "compliance-client",
    "compliance-server",
    "compliance-shell",
    "esign-server",
    "global-shell",
    "pdf-server",
    "topology-client",
    "topology-server",
    "topology-shell",
]


class ArchitectureReportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = json.loads(generate_architecture.MODEL_PATH.read_text(encoding="utf-8"))

    def test_existing_model_covers_skaffold_images_and_interaction_kinds(self) -> None:
        diagram = generate_architecture.render_mermaid(APPLICATION_IMAGES, self.model)

        self.assertIn('global_shell["global-shell"]', diagram)
        self.assertIn("Unified Custody: TemplateSelector", diagram)
        self.assertIn("NATS request / reply", " ".join(
            legend for _arrow, legend, _color, _style in generate_architecture.EDGE_TYPES.values()
        ))
        self.assertIn("compliance_server <-->|Generate PDF| pdf_server", diagram)
        self.assertIn("topology_server -.->|Publish transfer event updates| nats", diagram)

    def test_new_skaffold_image_is_discovered_without_model_changes(self) -> None:
        diagram = generate_architecture.render_mermaid(
            APPLICATION_IMAGES + ["new-service-image"],
            self.model,
        )

        self.assertIn('new_service_image["new-service-image"]', diagram)

    def test_model_rejects_relationships_to_unknown_images(self) -> None:
        invalid_model = dict(self.model)
        invalid_model["interactions"] = [
            {
                "from": "missing-image",
                "to": "nats",
                "type": "nats-pub-sub",
                "label": "unconfigured relationship",
            }
        ]

        with self.assertRaisesRegex(ValueError, "unknown architecture node"):
            generate_architecture.validate_model(APPLICATION_IMAGES, invalid_model)

    def test_image_names_that_collapse_to_same_mermaid_id_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "unique Mermaid node IDs"):
            generate_architecture.validate_model(
                ["service-api", "service_api"],
                {"externalNodes": [], "compositions": [], "interactions": []},
            )

    def test_architecture_artifacts_are_written(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            diagram = generate_architecture.render_mermaid(APPLICATION_IMAGES, self.model)

            (output_dir / "architecture.md").write_text(
                generate_architecture.render_markdown(diagram),
                encoding="utf-8",
            )
            (output_dir / "architecture.html").write_text(
                generate_architecture.render_html(diagram),
                encoding="utf-8",
            )

            self.assertIn("```mermaid", (output_dir / "architecture.md").read_text(encoding="utf-8"))
            self.assertIn("mermaid.run", (output_dir / "architecture.html").read_text(encoding="utf-8"))


class SbomReportTests(unittest.TestCase):
    def test_skaffold_build_output_becomes_image_ids_and_tags(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact_file = Path(temp_dir) / "artifacts.json"
            artifact_file.write_text(
                json.dumps({
                    "builds": [
                        {"imageName": "registry.example/platform/service", "tag": "registry.example/platform/service:abc123"},
                    ]
                }),
                encoding="utf-8",
            )

            self.assertEqual(
                [("service", "registry.example/platform/service:abc123")],
                generate_sbom_reports.load_builds(artifact_file),
            )

    def test_option_like_image_tags_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact_file = Path(temp_dir) / "artifacts.json"
            artifact_file.write_text(
                json.dumps({"builds": [{"imageName": "service", "tag": "--output=/tmp/x"}]}),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "unsupported characters"):
                generate_sbom_reports.load_builds(artifact_file)

    def test_duplicate_image_ids_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact_file = Path(temp_dir) / "artifacts.json"
            artifact_file.write_text(
                json.dumps({
                    "builds": [
                        {"imageName": "registry-a/service", "tag": "registry-a/service:one"},
                        {"imageName": "registry-b/service", "tag": "registry-b/service:two"},
                    ]
                }),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "unique SBOM filenames"):
                generate_sbom_reports.load_builds(artifact_file)

    def test_sbom_and_html_outputs_are_indexed_and_stale_reports_removed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            fake_trivy = temp_path / "trivy"
            fake_trivy.write_text(
                "#!/usr/bin/env python3\n"
                "import json, sys\n"
                "from pathlib import Path\n"
                "if '--version' in sys.argv:\n"
                "    print('Version: 0.76.1')\n"
                "    raise SystemExit(0)\n"
                "output = Path(sys.argv[sys.argv.index('--output') + 1])\n"
                "output.write_text(json.dumps({'bomFormat': 'CycloneDX', 'components': []}))\n",
                encoding="utf-8",
            )
            fake_trivy.chmod(0o755)
            fake_sunshine = temp_path / "sunshine.py"
            fake_sunshine.write_text(
                "import sys\n"
                "from pathlib import Path\n"
                "output = Path(sys.argv[sys.argv.index('--output') + 1])\n"
                "output.write_text('<html>SBOM report</html>')\n",
                encoding="utf-8",
            )
            output_dir = temp_path / "reports"
            output_dir.mkdir()
            (output_dir / "removed-image.cdx.json").write_text("{}", encoding="utf-8")
            (output_dir / "removed-image.html").write_text("stale", encoding="utf-8")

            generate_sbom_reports.generate_reports(
                [("service", "service:abc123")],
                str(fake_trivy),
                fake_sunshine,
                output_dir,
                "pinned",
            )

            self.assertTrue((output_dir / "service.cdx.json").is_file())
            self.assertTrue((output_dir / "service.html").is_file())
            self.assertIn("service:abc123", (output_dir / "index.md").read_text(encoding="utf-8"))
            self.assertEqual(
                {"trivy": "0.76.1", "cyclonedxSunshineRevision": "pinned"},
                json.loads((output_dir / "tool-versions.json").read_text(encoding="utf-8")),
            )
            self.assertFalse((output_dir / "removed-image.cdx.json").exists())
            self.assertFalse((output_dir / "removed-image.html").exists())


class ReportSynchronizationTests(unittest.TestCase):
    def write_reports(self, root: Path, image_id: str, serial: str, html_body: str) -> None:
        sbom_dir = root / "sbom"
        architecture_dir = root / "architecture"
        sbom_dir.mkdir(parents=True, exist_ok=True)
        architecture_dir.mkdir(parents=True, exist_ok=True)
        (sbom_dir / "service.cdx.json").write_text(
            json.dumps({
                "serialNumber": serial,
                "metadata": {
                    "component": {
                        "properties": [
                            {"name": "aquasecurity:trivy:ImageID", "value": image_id}
                        ]
                    }
                },
            }),
            encoding="utf-8",
        )
        (sbom_dir / "service.html").write_text(html_body, encoding="utf-8")
        (sbom_dir / "index.md").write_text(f"Image digest: {image_id}\n", encoding="utf-8")
        (sbom_dir / "tool-versions.json").write_text(
            json.dumps({"trivy": "0.76.1", "cyclonedxSunshineRevision": "pinned"}),
            encoding="utf-8",
        )
        (architecture_dir / "architecture.md").write_text("Architecture\n", encoding="utf-8")
        (architecture_dir / "architecture.html").write_text("<html>Architecture</html>", encoding="utf-8")

    def test_unchanged_image_does_not_commit_volatile_report_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            source = temp_path / "source"
            destination = temp_path / "destination"
            self.write_reports(source, "sha256:image-one", "serial-one", "first report")
            sync_generated_reports.sync_reports(source, destination)
            committed_sbom = (destination / "sbom/service.cdx.json").read_text(encoding="utf-8")
            committed_html = (destination / "sbom/service.html").read_text(encoding="utf-8")

            self.write_reports(source, "sha256:image-one", "serial-two", "regenerated report")
            sync_generated_reports.sync_reports(source, destination)

            self.assertEqual(committed_sbom, (destination / "sbom/service.cdx.json").read_text(encoding="utf-8"))
            self.assertEqual(committed_html, (destination / "sbom/service.html").read_text(encoding="utf-8"))
            self.assertEqual(
                "Image digest: sha256:image-one\n",
                (destination / "sbom/index.md").read_text(encoding="utf-8"),
            )

            self.write_reports(source, "sha256:image-two", "serial-three", "updated report")
            sync_generated_reports.sync_reports(source, destination)
            self.assertIn("serial-three", (destination / "sbom/service.cdx.json").read_text(encoding="utf-8"))
            self.assertEqual("updated report", (destination / "sbom/service.html").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
