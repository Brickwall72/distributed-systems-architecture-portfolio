# File: scripts/tests/test_documentation_reports.py
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.docs import generate_architecture, generate_dependency_reports, sync_generated_reports


SKAFFOLD_PATH = Path(__file__).resolve().parents[2] / "skaffold.yaml"
APPLICATION_IMAGES = sorted(
    re.findall(r"^\s*-\s*image:\s*(\S+)\s*$", SKAFFOLD_PATH.read_text(encoding="utf-8"), re.MULTILINE)
)


class ArchitectureReportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = json.loads(generate_architecture.MODEL_PATH.read_text(encoding="utf-8"))

    def test_existing_model_covers_skaffold_images_and_interaction_kinds(self) -> None:
        diagram = generate_architecture.render_mermaid(APPLICATION_IMAGES, self.model)

        self.assertIn('global_shell["global-shell"]', diagram)
        self.assertIn("Unified Custody: TemplateSelector", diagram)
        self.assertIn("NATS request / reply", " ".join(
            legend for _arrow, legend, _color, _style, _color_name in generate_architecture.EDGE_TYPES.values()
        ))
        self.assertIn("compliance_server <-->|Generate PDF| pdf_server", diagram)
        self.assertNotIn("nats_bootstrap", diagram)
        self.assertIn("compliance_server <-->|Validate drafts and reserve transfers| topology_server", diagram)
        self.assertIn("nats -.->|Deliver signed transfer for reserved application| topology_server", diagram)
        self.assertIn("topology_server -.->|Publish committed transfer results| nats", diagram)
        self.assertIn("audit_server <-->|Generate PDF| pdf_server", diagram)
        self.assertNotIn("Deliver transfer initiated / received", diagram)

    def test_storage_nodes_and_relationships_are_rendered(self) -> None:
        diagram = generate_architecture.render_mermaid(APPLICATION_IMAGES, self.model)

        for node in (
            'topology_db[("Neo4j (topology)")]:::storage',
            'compliance_db[("PostgreSQL (compliance)")]:::storage',
            'audit_db[("MongoDB (audit)")]:::storage',
            'minio[("MinIO object storage")]:::storage',
        ):
            self.assertIn(node, diagram)
        for edge in (
            "topology_server -->|Neo4j Bolt| topology_db",
            "compliance_server -->|PostgreSQL| compliance_db",
            "audit_server -->|MongoDB| audit_db",
            "pdf_server -->|S3 document upload| minio",
            "esign_server -->|S3 document read / upload| minio",
            "compliance_client -->|Presigned document download| minio",
            "audit_client -->|Presigned overview download| minio",
        ):
            self.assertIn(edge, diagram)

    def test_legends_describe_rendered_edge_styles(self) -> None:
        diagram = generate_architecture.render_mermaid(APPLICATION_IMAGES, self.model)
        markdown = generate_architecture.render_markdown(diagram)
        html = generate_architecture.render_html(diagram)
        edge_index = sum(len(composition["widgets"]) for composition in self.model["compositions"])

        for interaction in self.model["interactions"]:
            arrow, label, color, line_style, color_name = generate_architecture.EDGE_TYPES[interaction["type"]]
            source = generate_architecture.mermaid_node_id(interaction["from"])
            target = generate_architecture.mermaid_node_id(interaction["to"])
            self.assertIn(f'{source} {arrow}|{interaction["label"]}| {target}', diagram)
            style = f"linkStyle {edge_index} stroke:{color},stroke-width:2px"
            if line_style == "dashed":
                style += ",stroke-dasharray: 6 4"
            self.assertIn(style, diagram)
            self.assertIn(f"**{label}** - {color_name}, {line_style} line (`{color}`)", markdown)
            self.assertIn(f"{label} - {color_name}, {line_style} line ({color})", html)
            edge_index += 1

        self.assertIn("thick, solid purple", markdown)
        self.assertIn("thick, solid purple", html)

    def test_external_nodes_reject_unknown_kind(self) -> None:
        invalid_model = dict(self.model)
        invalid_model["externalNodes"] = [{"id": "test", "label": "Test", "kind": "unknown"}]
        invalid_model["interactions"] = []

        with self.assertRaisesRegex(ValueError, "must have kind"):
            generate_architecture.validate_model(APPLICATION_IMAGES, invalid_model)

    def test_external_node_without_kind_remains_a_broker(self) -> None:
        model = {"externalNodes": [{"id": "test", "label": "Test"}], "compositions": [], "interactions": []}

        self.assertIn('test["Test"]:::broker', generate_architecture.render_mermaid([], model))

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


class InternalReportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        self.packages = {
            "topology-server": ("services/topology/server", {}),
            "topology-client": ("services/topology/client", {}),
            "topology-shell": ("ui-shells/topology-shell", {}),
            "compliance-server": ("services/compliance/server", {}),
            "audit-server": ("services/audit/server", {}),
        }
        for name, (path, dependencies) in self.packages.items():
            directory = self.root / path
            directory.mkdir(parents=True)
            (directory / "package.json").write_text(json.dumps({
                "name": name, "dependencies": {"third-party-library": "1.0.0", **dependencies},
            }))
            (directory / "src").mkdir()
            for filename in ("client.ts", "Canvas.tsx", "Dashboard.tsx"):
                (directory / "src" / filename).write_text("\n" * 12)
            (directory / "vite.config.ts").write_text("\n" * 8)
        (self.root / "skaffold.yaml").write_text(
            "build:\n  artifacts:\n" + "".join(f"    - image: {name}\n" for name in self.packages)
            + "deploy:\n")
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        self.model = {
            "externalNodes": [{"id": "topology-db", "label": "Neo4j", "kind": "storage"},
                              {"id": "nats", "label": "NATS", "kind": "broker"}],
            "compositions": [],
            "interactions": [
                {"from": "topology-server", "to": "topology-db", "type": "storage", "label": "Query"},
                {"from": "topology-client", "to": "topology-server", "type": "http", "label": "API"},
            ],
        }
        self.analysis = {"version": 1, "calls": [], "gaps": [],
                         "federation": {"exposes": [], "uses": []}}

    def call(self, component, kind, value):
        return {
            "id": component + kind, "component": component, "kind": kind,
            "source": {"path": self.packages[component][0] + "/src/client.ts", "line": 12},
            "function": "send", "callee": "broker." + kind.removeprefix("nats-"),
            "target": "nats", "channel": {"expression": "SUBJECT", "value": value},
            "contracts": [], "status": "verified", "callers": [],
        }

    def test_html_source_links_point_to_master_and_escape_paths(self):
        evidence = {"path": "services/test & demo/server.ts", "line": 12}
        self.assertEqual(
            generate_dependency_reports.source_link(evidence, html_output=True),
            '<a href="https://github.com/Brickwall72/distributed-systems-architecture-portfolio'
            '/blob/master/services/test%20%26%20demo/server.ts#L12">'
            'services/test &amp; demo/server.ts:12</a>',
        )
        self.assertEqual(
            generate_dependency_reports.source_link(evidence),
            "[services/test & demo/server.ts:12](../../../services/test & demo/server.ts#L12)",
        )

    def test_vertical_slice_reaches_widget_and_shell_page(self):
        self.analysis["federation"] = {
            "exposes": [{"component": "topology-client", "remote": "topology_client",
                         "module": "NetworkCanvas", "implementation": "services/topology/client/src/Canvas.tsx",
                         "source": {"path": "services/topology/client/vite.config.ts", "line": 8}}],
            "uses": [{"component": "topology-shell", "remote": "topology_client",
                      "module": "NetworkCanvas", "function": "Dashboard",
                      "source": {"path": "ui-shells/topology-shell/src/Dashboard.tsx", "line": 4}}],
        }
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        database = next(item for item in report["slices"] if item["root"] == "infrastructure:topology-db")
        shell = next(item for item in database["dependents"]
                     if item["component"] == "workspace:topology-shell")
        self.assertEqual(shell["path"][:3], [
            "infrastructure:topology-db", "workspace:topology-server", "workspace:topology-client",
        ])
        self.assertTrue(any(node.startswith("widget:") for node in shell["path"]))
        self.assertTrue(any(node.startswith("page:") for node in shell["path"]))
        self.assertNotIn("third-party-library", json.dumps(report))

    def test_shared_broker_does_not_create_all_to_all_payload_dependencies(self):
        self.analysis["calls"] = [
            self.call("topology-server", "nats-publish", "transfer.committed"),
            self.call("audit-server", "nats-subscribe", "transfer.committed"),
            self.call("compliance-server", "nats-subscribe", "different.subject"),
        ]
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        events = [edge for edge in report["dependencies"] if edge["type"] == "event-payload"]
        self.assertEqual([(edge["from"], edge["to"]) for edge in events],
                         [("workspace:audit-server", "workspace:topology-server")])

    def test_unresolved_subjects_are_not_joined_and_gaps_are_rendered(self):
        self.analysis["calls"] = [
            self.call("topology-server", "nats-publish", None),
            self.call("audit-server", "nats-subscribe", None),
        ]
        self.analysis["gaps"] = [{
            "source": {"path": "services/topology/server/src/client.ts", "line": 12},
            "reason": "Dynamic subject cannot be resolved <safely>",
        }]
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        self.assertFalse(any(edge["type"] == "event-payload" for edge in report["dependencies"]))
        self.assertIn("Dynamic subject", generate_dependency_reports.render_markdown(report))
        self.assertIn("&lt;safely&gt;", generate_dependency_reports.render_html(report))

    def test_nats_subject_wildcards_link_only_matching_consumers(self):
        self.analysis["calls"] = [
            self.call("topology-server", "nats-publish", "transfer.committed.final"),
            self.call("audit-server", "nats-subscribe", "transfer.>"),
            self.call("compliance-server", "nats-subscribe", "transfer.*"),
        ]
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        events = [edge for edge in report["dependencies"] if edge["type"] == "event-payload"]
        self.assertEqual([(edge["from"], edge["to"]) for edge in events],
                         [("workspace:audit-server", "workspace:topology-server")])
        self.assertEqual(len(events[0]["evidence"]), 2)

    def test_duplicate_or_unknown_call_components_fail(self):
        call = self.call("topology-server", "nats-publish", "subject")
        self.analysis["calls"] = [call, call]
        with self.assertRaisesRegex(ValueError, "unique identifiers"):
            generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        self.analysis["calls"] = [{**call, "component": "missing"}]
        with self.assertRaisesRegex(ValueError, "unknown workspace"):
            generate_dependency_reports.build_report(self.root, self.model, self.analysis)

    def test_shared_contract_lists_real_consumers_not_unrelated_services(self):
        path = self.root / "packages/contracts/topology"
        path.mkdir(parents=True)
        (path / "package.json").write_text(json.dumps({"name": "@contracts/topology"}))
        for name in ("topology-server", "topology-client", "compliance-server"):
            package = self.root / self.packages[name][0] / "package.json"
            manifest = json.loads(package.read_text())
            manifest["dependencies"]["@contracts/topology"] = "workspace:*"
            package.write_text(json.dumps(manifest))
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        contract = next(item for item in report["slices"] if item["root"] == "workspace:@contracts/topology")
        self.assertEqual({item["component"] for item in contract["dependents"]},
                         {"workspace:topology-server", "workspace:topology-client",
                          "workspace:compliance-server"})

    def test_contradictory_federation_exposures_fail(self):
        expose = {"component": "topology-client", "remote": "topology_client",
                  "module": "NetworkCanvas", "implementation": "services/topology/client/src/Canvas.tsx",
                  "source": {"path": "services/topology/client/vite.config.ts", "line": 8}}
        self.analysis["federation"]["exposes"] = [
            expose, {**expose, "implementation": "services/topology/client/src/client.ts"},
        ]
        with self.assertRaisesRegex(ValueError, "Contradictory federation"):
            generate_dependency_reports.build_report(self.root, self.model, self.analysis)

    def test_repeated_generation_and_synchronization_do_not_rewrite_reports(self):
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        output = self.root / "generated"
        generate_dependency_reports.write_reports(report, output / "dependencies")
        (output / "architecture").mkdir()
        for name in ("architecture.md", "architecture.html"):
            (output / "architecture" / name).write_text("overview")
        destination = self.root / "published"
        sync_generated_reports.sync_reports(output, destination)
        original = {name: (destination / name).stat().st_mtime_ns
                    for name in sync_generated_reports.REPORT_FILES}
        generate_dependency_reports.write_reports(report, output / "dependencies")
        sync_generated_reports.sync_reports(output, destination)
        self.assertEqual(original, {name: (destination / name).stat().st_mtime_ns
                                    for name in sync_generated_reports.REPORT_FILES})

    def test_incomplete_report_bundle_fails_before_touching_destination(self):
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        source = self.root / "source"
        generate_dependency_reports.write_reports(report, source / "dependencies")
        destination = self.root / "destination"
        destination.mkdir()
        untouched = destination / "notes.txt"
        untouched.write_text("keep")
        with self.assertRaisesRegex(ValueError, "missing"):
            sync_generated_reports.sync_reports(source, destination)
        self.assertEqual(list(destination.iterdir()), [untouched])

    def test_sync_rejects_dangling_calls_and_contradictory_impact_paths(self):
        report = generate_dependency_reports.build_report(self.root, self.model, self.analysis)
        report["boundaryCalls"] = [{**self.call("topology-server", "nats-publish", "subject"),
                                    "component": "missing"}]
        with self.assertRaisesRegex(ValueError, "boundary calls"):
            sync_generated_reports.validate_dependency_graph(report)
        report["boundaryCalls"] = []
        report["slices"] = [{"root": "workspace:topology-server", "dependents": [{
            "component": "workspace:topology-client", "path": ["workspace:topology-client"],
        }]}]
        with self.assertRaisesRegex(ValueError, "contradictory"):
            sync_generated_reports.validate_dependency_graph(report)


if __name__ == "__main__":
    unittest.main()
