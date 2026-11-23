import importlib.util
import io
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from contextlib import redirect_stdout
from urllib.error import HTTPError


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("publish_demo_ui_images", ROOT / "scripts/ci/publish-demo-ui-images.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

SOURCE = "b" * 40
PREVIOUS_SOURCE = "a" * 40
REGISTRY = "ghcr.io/example/demo"
DIGEST = "sha256:" + "1" * 64


def previous():
    return {
        "source": PREVIOUS_SOURCE,
        "images": {name: f"{REGISTRY}/{name}@{DIGEST}" for name in publisher.BUILDS},
    }


class PublishDemoUiImagesTests(unittest.TestCase):
    def run_publish(self, selected, old):
        calls = []

        def command(*args, capture=False):
            calls.append(args)
            if args[:2] == ("git", "rev-parse"):
                return SOURCE + "\n"
            if args[0] == "python3":
                return json.dumps(selected)
            if args[:4] == ("docker", "buildx", "imagetools", "inspect"):
                return "sha256:" + "2" * 64 + "\n"
            return ""

        with patch.object(publisher, "command", side_effect=command):
            result = publisher.publish(SOURCE, REGISTRY, old)
        return result, calls

    def test_docs_only_reuses_all_image_digests_without_building(self):
        old = previous()
        result, calls = self.run_publish([], old)
        self.assertEqual(result["images"], old["images"])
        self.assertEqual(result["source"], SOURCE)
        self.assertFalse(any(call[0] == "docker" for call in calls))

    def test_only_selected_image_is_built_and_others_are_preserved(self):
        old = previous()
        result, calls = self.run_publish(["global-shell"], old)
        self.assertEqual(result["images"]["global-shell"], f"{REGISTRY}/global-shell@sha256:" + "2" * 64)
        self.assertEqual(result["images"]["auth-client"], old["images"]["auth-client"])
        pushes = [call for call in calls if call[:2] == ("docker", "push")]
        self.assertEqual(pushes, [("docker", "push", f"{REGISTRY}/global-shell:{SOURCE}")])

    def test_first_publication_builds_all_images(self):
        result, calls = self.run_publish([], None)
        self.assertEqual(set(result["images"]), set(publisher.BUILDS))
        self.assertEqual(len([call for call in calls if call[:2] == ("docker", "push")]), len(publisher.BUILDS))

    def test_published_images_override_base_image_source_and_revision(self):
        _, calls = self.run_publish([], None)
        builds = [call for call in calls if call[:4] == ("docker", "build", "--target", "prod")]
        self.assertEqual(len(builds), len(publisher.BUILDS))
        for build in builds:
            labels = [build[index + 1] for index, value in enumerate(build) if value == "--label"]
            self.assertIn(f"org.opencontainers.image.source={publisher.SOURCE_REPOSITORY}", labels)
            self.assertIn(f"org.opencontainers.image.revision={SOURCE}", labels)

    def test_rejects_unexpected_or_wrong_registry_images(self):
        old = previous()
        old["images"]["auth-client"] = "ghcr.io/attacker/auth-client@" + DIGEST
        with self.assertRaises(ValueError):
            publisher.validate_manifest(old, REGISTRY)

    def test_refuses_a_dirty_checkout(self):
        def command(*args, capture=False):
            return SOURCE if args[:2] == ("git", "rev-parse") else " M ui-shells/global-shell/src/App.tsx"

        with patch.object(publisher, "command", side_effect=command), self.assertRaisesRegex(ValueError, "clean"):
            publisher.publish(SOURCE, REGISTRY, None)


class RegistryAccessTests(unittest.TestCase):
    def test_checks_every_package_without_printing_tokens_or_building(self):
        output = io.StringIO()
        with patch.object(publisher, "build_opener") as build_opener, \
                patch.object(publisher, "command") as command, redirect_stdout(output):
            opener = build_opener.return_value
            opener.open.side_effect = [
                io.BytesIO(b'{"token": "fake-registry-token"}') for _ in publisher.BUILDS
            ]
            publisher.check_registry_access(REGISTRY, "example", "fake-workflow-token")
        scopes = [call.args[0].full_url for call in opener.open.call_args_list]
        self.assertEqual(len(scopes), len(publisher.BUILDS))
        for name in publisher.BUILDS:
            self.assertTrue(any(f"%2F{name}%3Apull%2Cpush" in url for url in scopes))
        self.assertNotIn("fake-registry-token", output.getvalue())
        self.assertNotIn("fake-workflow-token", output.getvalue())
        command.assert_not_called()

    def test_rejection_names_package_and_status_without_response_credentials(self):
        with patch.object(publisher, "build_opener") as build_opener, \
                patch.object(publisher, "command") as command:
            build_opener.return_value.open.side_effect = HTTPError(
                "https://ghcr.io/token", 403, "fake-sensitive-response", {}, None,
            )
            with self.assertRaises(ValueError) as raised:
                publisher.check_registry_access(REGISTRY, "example", "fake-workflow-token")
        self.assertEqual(str(raised.exception), "GHCR authorization rejected for audit-client: HTTP 403.")
        command.assert_not_called()

    def test_refuses_missing_credentials_without_contacting_registry(self):
        with patch.object(publisher, "build_opener") as build_opener:
            with self.assertRaisesRegex(ValueError, "required"):
                publisher.check_registry_access(REGISTRY, "example", "")
        build_opener.assert_not_called()


@unittest.skipUnless(shutil.which("git") and shutil.which("bash"), "Git and Bash are required")
class PublishDemoUiReleaseTests(unittest.TestCase):
    def test_publication_branch_reuses_unchanged_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            remote, repo, bin_dir = root / "remote.git", root / "repo", root / "bin"
            subprocess.run(["git", "init", "--bare", str(remote)], check=True, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
            subprocess.run(["git", "init", "-b", "master", str(repo)], check=True, stdout=subprocess.DEVNULL)
            def git(*args):
                return subprocess.run(["git", *args], cwd=repo, check=True, text=True,
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()
            git("config", "user.name", "Test")
            git("config", "user.email", "test@example.invalid")
            git("remote", "add", "origin", str(remote))
            (repo / "scripts/ci").mkdir(parents=True)
            for name in ("publish-demo-ui-release.sh", "publish-demo-ui-images.py", "select-demo-ui-images.py"):
                shutil.copy(ROOT / "scripts/ci" / name, repo / "scripts/ci" / name)
            (repo / "README.md").write_text("initial\n")
            git("add", ".")
            git("commit", "-m", "Initial")
            git("push", "origin", "master")
            bin_dir.mkdir()
            docker = bin_dir / "docker"
            docker.write_text(
                '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_CALLS"\n'
                'if [ "$1" = push ] && [ "${FAIL_PUSH:-}" = yes ]; then exit 1; fi\n'
                'if [ "$1" = buildx ]; then printf "%s\\n" "sha256:'
                + "2" * 64 + '"; fi\n'
            )
            docker.chmod(0o755)
            calls = root / "docker-calls"
            def publish(index, fail=False):
                temp = root / f"runner-{index}"
                temp.mkdir()
                env = dict(os.environ, PATH=f"{bin_dir}:{os.environ['PATH']}", RUNNER_TEMP=str(temp),
                           GITHUB_SHA=git("rev-parse", "HEAD"), GITHUB_REPOSITORY_OWNER="Example",
                           DOCKER_CALLS=str(calls))
                if fail:
                    env["FAIL_PUSH"] = "yes"
                subprocess.run(
                    ["bash", "scripts/ci/publish-demo-ui-release.sh"], cwd=repo, env=env,
                    check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                )
                return json.loads(git("show", "origin/demo-ui-published:demo-ui-images.json"))
            first = publish(1)
            self.assertEqual(len([line for line in calls.read_text().splitlines() if line.startswith("push ")]), 7)
            calls.write_text("")
            (repo / "README.md").write_text("documentation update\n")
            git("add", "README.md")
            git("commit", "-m", "Update documentation")
            second = publish(2)
            self.assertEqual(second["images"], first["images"])
            self.assertEqual(calls.read_text(), "")
            component = repo / "ui-shells/global-shell/src"
            component.mkdir(parents=True)
            (component / "App.tsx").write_text("changed\n")
            git("add", "ui-shells")
            git("commit", "-m", "Update UI")
            third = publish(3)
            self.assertEqual(third["source"], git("rev-parse", "HEAD"))
            self.assertEqual(len([line for line in calls.read_text().splitlines() if line.startswith("push ")]), 1)
            (component / "App.tsx").write_text("another change\n")
            git("add", "ui-shells")
            git("commit", "-m", "Another UI update")
            with self.assertRaises(subprocess.CalledProcessError):
                publish(4, fail=True)
            self.assertEqual(json.loads(git("show", "origin/demo-ui-published:demo-ui-images.json")), third)


if __name__ == "__main__":
    unittest.main()
