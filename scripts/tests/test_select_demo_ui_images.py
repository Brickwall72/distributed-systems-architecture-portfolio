import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("select_demo_ui_images", ROOT / "scripts/select-demo-ui-images.py")
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


if __name__ == "__main__":
    unittest.main()
