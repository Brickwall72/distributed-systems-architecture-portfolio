import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("select_demo_ui_images", ROOT / "scripts/ci/select-demo-ui-images.py")
selector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selector)


class SelectDemoUiImagesTests(unittest.TestCase):
    def test_documentation_does_not_select_images(self):
        self.assertEqual(selector.select_images([
            "README.md", "docs/architecture/overview.md", "packages/ui/README.md",
            "ui-shells/global-shell/README.md", "packages/ui/docs/details.md",
        ]), [])

    def test_shared_base_inputs_select_every_ui_image(self):
        for path in ("packages/styles/src/global.css", "pnpm-lock.yaml", "Dockerfile.base",
                     "services/platform/esign-service/client/src/index.ts"):
            with self.subTest(path=path):
                self.assertEqual(selector.select_images([path]), sorted(selector.IMAGES))

    def test_component_changes_select_affected_images(self):
        self.assertEqual(selector.select_images([
            "services/core/topology-service/client/src/App.tsx",
            "services/core/compliance-service/shared/src/index.ts",
            "ui-shells/global-shell/Dockerfile",
            "services/core/audit-ledger/server/src/server.ts",
        ]), ["compliance-client", "global-shell", "topology-client"])

    def test_markdown_inside_ui_source_can_be_a_build_input(self):
        self.assertEqual(selector.select_images([
            "ui-shells/global-shell/public/docs/help.md",
        ]), ["global-shell"])

    def test_prefixes_do_not_match_other_components(self):
        self.assertEqual(selector.select_images([
            "ui-shells/global-shell-other/src/App.tsx",
            "services/core/topology-service/Dockerfile.client.backup",
        ]), [])

    def test_operations_and_docs_skip_browser_and_publication(self):
        paths = ["scripts/demo-vm/k8s-demo-ui-update.py", "scripts/tests/test_demo_ui_update.py",
                 "scripts/demo-vm/systemd/dsap-demo-ui-prefetch.timer", "README.md"]
        self.assertEqual(selector.select_checks(paths, paths), ([], False))

    def test_smoke_infrastructure_runs_browser(self):
        for path in ("scripts/ci/demo-ui-browser-smoke.mjs",
                     "charts/platform-lib/templates/_client.tpl"):
            with self.subTest(path=path):
                self.assertEqual(selector.select_checks([path], [path]), ([], True))

    def test_ci_selection_and_backend_changes_do_not_run_browser(self):
        for path in (".github/workflows/ci.yaml", "scripts/ci/select-demo-ui-images.py",
                     "scripts/tests/test_select_demo_ui_images.py",
                     "services/platform/pdf-generator/server/src/index.ts"):
            with self.subTest(path=path):
                self.assertEqual(selector.select_checks([path], [path]), ([], False))

    def test_documentation_inside_infrastructure_does_not_run_browser(self):
        self.assertEqual(selector.select_checks([], ["charts/platform-lib/README.md"]), ([], False))

    def test_operations_and_workflow_only_select_automation(self):
        for path in ("scripts/demo-vm/k8s-demo-ui-update.py", ".github/workflows/ci.yaml"):
            checks = selector.verification_checks([path], {})
            self.assertEqual({name for name, enabled in checks.items() if enabled}, {"automation"})

    def test_docs_select_no_verification(self):
        checks = selector.verification_checks(["README.md", "packages/ui/README.md"], {})
        self.assertFalse(any(checks.values()))

    def test_dependency_changes_select_relevant_integration_suite(self):
        graph = {
            "@shared/messaging": ("packages/messaging/", set()),
            "topology-server": ("services/core/topology-service/server/", {"@shared/messaging"}),
            "compliance-shell": ("ui-shells/domain-shells/compliance-shell/", {"@shared/ui-components"}),
            "@shared/ui-components": ("packages/ui/", set()),
        }
        server = selector.verification_checks(["packages/messaging/src/index.ts"], graph)
        self.assertTrue(server["service_integration"])
        self.assertFalse(server["ui_integration"])
        ui = selector.verification_checks(["packages/ui/src/index.ts"], graph)
        self.assertTrue(ui["ui_integration"])
        self.assertFalse(ui["service_integration"])
        self.assertFalse(ui["contracts"])

    def test_integration_harness_runs_services_without_browser(self):
        paths = ["scripts/integration/integration-compose.yaml"]
        self.assertTrue(selector.verification_checks(paths, {})["service_integration"])
        self.assertEqual(selector.select_checks(paths, paths), ([], False))

    def test_unpublished_ui_changes_and_initial_publication_run_both(self):
        self.assertEqual(selector.select_checks(
            ["ui-shells/global-shell/src/App.tsx"], ["README.md"]),
            (["global-shell"], True))
        self.assertEqual(selector.select_checks([], [], initial=True),
                         (sorted(selector.IMAGES), True))

    def test_cli_revisions_cannot_be_git_options(self):
        with self.assertRaisesRegex(ValueError, "commit SHAs"):
            selector.changed_paths("--output=unexpected", "a" * 40)

    def test_cli_outputs_skip_expensive_checks_for_ci_only_changes(self):
        self.assert_ci_outputs(".github/workflows/ci.yaml", {
            "images": "false", "smoke": "false", "workspace": "false",
            "node": "false", "automation": "true", "full_workspace": "false",
        })

    def test_cli_global_build_inputs_force_full_workspace_checks(self):
        self.assert_ci_outputs("pnpm-lock.yaml", {
            "images": "true", "smoke": "true", "workspace": "true",
            "service_integration": "true", "ui_integration": "true",
            "contracts": "true", "full_workspace": "true",
        })

    def assert_ci_outputs(self, changed_file, expected):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts/ci").mkdir(parents=True)
            shutil.copyfile(ROOT / "scripts/ci/select-demo-ui-images.py",
                            root / "scripts/ci/select-demo-ui-images.py")
            package = root / "ui-shells/global-shell/package.json"
            package.parent.mkdir(parents=True)
            package.write_text(json.dumps({"name": "global-shell"}))
            def git(*args):
                return subprocess.run(
                    ["git", *args], cwd=root, check=True,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                ).stdout.strip()
            git("init")
            git("add", ".")
            git("-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                "commit", "-m", "baseline")
            base = git("rev-parse", "HEAD")
            path = root / changed_file
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("changed")
            git("add", ".")
            git("-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                "commit", "-m", "change")
            output = root / "outputs"
            subprocess.run(
                ["python3", "scripts/ci/select-demo-ui-images.py", base, git("rev-parse", "HEAD"),
                 "--github-output", str(output)], cwd=root, check=True, stdout=subprocess.PIPE,
            )
            actual = dict(line.split("=", 1) for line in output.read_text().splitlines())
            for name, value in expected.items():
                self.assertEqual(actual[name], value, name)


if __name__ == "__main__":
    unittest.main()
