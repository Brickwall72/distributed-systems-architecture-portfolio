# File: scripts/tests/test_secret_bootstrap.py
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


env = load("copy_env", "dev-env/copy-env.py")
k8s = load("k8s_local_secrets", "k8s-local/k8s-local-secrets.py")
demo = load("k8s_demo_secrets", "demo-vm/k8s-demo-secrets.py")
compose = load("prepare_local_compose", "dev-env/prepare-local-compose.py")
reset = load("reset_local_compose", "dev-env/reset-local-compose.py")


class EnvironmentMergeTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("pnpm") and shutil.which("openssl"), "pnpm and openssl are required")
    def test_dev_prepare_recovers_from_preserved_legacy_minio_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script_dir = root / "scripts"
            script_dir.mkdir()
            for name in ("dev-env/copy-env.py", "dev-env/prepare-local-compose.py",
                         "k8s-local/k8s-local-secrets.py", "dev-env/generate-auth-keys.sh",
                         "dev-env/generate-nats-credentials.sh"):
                target = script_dir / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / "scripts" / name, target)
            package = json.loads((ROOT / "package.json").read_text())
            isolated_package = {
                "name": package["name"],
                "private": True,
                "packageManager": package["packageManager"],
                "scripts": {name: package["scripts"][name]
                            for name in ("env:copy", "dev:credentials", "dev:prepare")},
            }
            (root / "package.json").write_text(json.dumps(isolated_package))
            for name, relative in compose.configuration()[0].items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                example = ROOT / relative
                shutil.copyfile(example.with_name(".env.example"), target.with_name(".env.example"))
                if name in ("compliance", "audit", "esign", "pdf"):
                    original = target.with_name(".env.example").read_text()
                    lines = original.splitlines()
                    target.write_text("\n".join(
                        "S3_ACCESS_KEY=legacy-shared-access" if line.startswith("S3_ACCESS_KEY=")
                        else "S3_SECRET_KEY=legacy-shared-secret" if line.startswith("S3_SECRET_KEY=")
                        else line for line in lines
                    ) + "\n")
            certificate = Path("services/platform/esign-service/server/certs/certificate.p12")
            (root / certificate).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / certificate, root / certificate)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            fake_docker = fake_bin / "docker"
            fake_docker.write_text("#!/bin/sh\nexit 0\n")
            fake_docker.chmod(0o755)
            environment = {**os.environ, "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}"}

            def prepare():
                return subprocess.run(["pnpm", "dev:prepare"], cwd=root, env=environment,
                                      capture_output=True, text=True)

            failed = prepare()
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn("Conflicting entries", failed.stdout + failed.stderr)
            self.assertNotIn("legacy-shared-secret", failed.stdout + failed.stderr)
            self.assertFalse((root / ".auth-keys/local").exists())
            for name, relative in compose.configuration()[0].items():
                if name in ("compliance", "audit", "esign", "pdf"):
                    target = root / relative
                    defaults = env.assignments(target.with_name(".env.example").read_text(), target)
                    original = target.read_text()
                    for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY"):
                        original = re.sub(rf"^{key}=.*$", f"{key}={defaults[key]}", original, flags=re.MULTILINE)
                    target.write_text(original)
            succeeded = prepare()
            self.assertEqual(succeeded.returncode, 0, succeeded.stderr)
            self.assertTrue((root / ".auth-keys/local/credentials.json").is_file())
            self.assertTrue((root / ".auth-keys/nats/broker.env").is_file())
            keys_before = (root / ".auth-keys/private.pem").read_bytes()
            credentials_before = (root / ".auth-keys/local/credentials.json").read_bytes()
            repeated = prepare()
            self.assertEqual(repeated.returncode, 0, repeated.stderr)
            self.assertEqual((root / ".auth-keys/private.pem").read_bytes(), keys_before)
            self.assertEqual((root / ".auth-keys/local/credentials.json").read_bytes(), credentials_before)

    def test_legacy_shared_minio_credentials_are_preserved_and_reported_without_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths, required = compose.configuration()
            for name, relative in paths.items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                defaults = {key: f"{name}-{key}-fixture" for key in required[name]}
                target.with_name(".env.example").write_text(
                    "".join(f"{key}={value}\n" for key, value in defaults.items())
                )
                if name in ("compliance", "audit"):
                    defaults["S3_ACCESS_KEY"] = "legacy-shared-access"
                    defaults["S3_SECRET_KEY"] = "legacy-shared-secret"
                target.write_text("".join(f"{key}={value}\n" for key, value in defaults.items()))
            env.copy_env(root)
            values = {name: k8s.env_file(root / path) for name, path in paths.items()}
            with self.assertRaises(ValueError) as error:
                compose.validate_credentials(values, paths, required)
            message = str(error.exception)
            for name in ("compliance", "audit"):
                for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY"):
                    self.assertIn(f"{paths[name]}:{key}", message)
            self.assertNotIn("legacy-shared-access", message)
            self.assertNotIn("legacy-shared-secret", message)
            self.assertIn("legacy-shared-secret", (root / paths["audit"]).read_text())
            for name in ("compliance", "audit"):
                target = root / paths[name]
                target.write_text(target.with_name(".env.example").read_text())
            cert = root / "services/platform/esign-service/server/certs/certificate.p12"
            cert.parent.mkdir(parents=True)
            cert.write_bytes(b"synthetic certificate")
            values = {name: k8s.env_file(root / path) for name, path in paths.items()}
            with patch.object(compose, "ROOT", root), patch.object(
                compose.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)
            ):
                compose.validate_credentials(values, paths, required)

    def test_empty_credential_requires_manual_edit_after_env_merge(self):
        paths, required = compose.configuration()
        values = {name: {key: "fixture" for key in keys} for name, keys in required.items()}
        values["compliance"]["DB_PASSWORD"] = ""
        with self.assertRaises(ValueError) as error:
            compose.validate_credentials(values, paths, required)
        self.assertIn("DB_PASSWORD", str(error.exception))
        self.assertIn("empty values manually", str(error.exception))

    def test_create_merge_and_repeat(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            template = root / ".env.example"
            target = root / ".env"
            template.write_text("# Example\nFIRST=one\nOLD=old\n")
            env.copy_env(root)
            target.write_text("# custom\nFIRST=custom\nOLD=old\nEXTRA=value\n")
            template.write_text("FIRST=new-default\nNEW=two\n")
            env.copy_env(root)
            result = target.read_text()
            self.assertIn("FIRST=custom", result)
            self.assertIn("OLD=old", result)
            self.assertIn("EXTRA=value", result)
            self.assertIn("NEW=two", result)
            env.copy_env(root)
            self.assertEqual(target.read_text(), result)
            env.copy_env(root, reset=True)
            self.assertEqual(target.read_text(), template.read_text())

    def test_duplicate_entries_fail_without_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env.example").write_text("KEY=example\nNEW=new\n")
            target = root / ".env"
            target.write_text("KEY=one\nKEY=two\n")
            with self.assertRaisesRegex(ValueError, "duplicate variable"):
                env.copy_env(root)
            self.assertEqual(target.read_text(), "KEY=one\nKEY=two\n")

    def test_hidden_and_dependency_directories_are_not_scanned(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in (".tools", "node_modules"):
                nested = root / name
                nested.mkdir()
                (nested / ".env.example").write_text("KEY=value\n")
            env.copy_env(root)
            self.assertFalse((root / ".tools/.env").exists())
            self.assertFalse((root / "node_modules/.env").exists())

    def test_compose_credential_changes_require_verifiable_empty_state(self):
        with tempfile.TemporaryDirectory() as directory:
            pointer = Path(directory)
            (pointer / "credentials.json").write_text("old")
            with patch.object(compose.subprocess, "run") as docker:
                compose.guard_existing_state(pointer, "old")
                docker.assert_not_called()
                docker.return_value.stdout = b""
                compose.guard_existing_state(pointer, "new")
                self.assertEqual(docker.call_count, 4)
                docker.return_value.stdout = b"existing-state\n"
                with self.assertRaisesRegex(ValueError, "existing state"):
                    compose.guard_existing_state(pointer, "new")
            with patch.object(compose.subprocess, "run", side_effect=FileNotFoundError):
                with self.assertRaisesRegex(ValueError, "Cannot verify"):
                    compose.guard_existing_state(pointer, "new")
            with patch.object(compose.subprocess, "run") as docker:
                docker.return_value.stdout = b""
                compose.guard_existing_state(pointer, "new", accept_existing_state=True)
                self.assertEqual(docker.call_count, 6)
                docker.side_effect = lambda args, **kwargs: subprocess.CompletedProcess(
                    args, 0, stdout=b"running\n" if args[1:3] == ("ps", "-q") else b"existing-state\n")
                with self.assertRaisesRegex(ValueError, "running containers"):
                    compose.guard_existing_state(pointer, "new", accept_existing_state=True)

    def test_explicit_credential_handoff_requires_confirmation(self):
        result = subprocess.run(
            ["python3", str(ROOT / "scripts/dev-env/prepare-local-compose.py"), "--accept-provisioned-credentials"],
            input=b"no\n", stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"confirmation was not provided", result.stderr)

    @unittest.skipUnless(shutil.which("docker"), "docker compose is unavailable")
    def test_compose_uses_service_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = [ROOT / "compose.yaml"]
            for base in ("services", "ui-shells"):
                files.extend(path for path in (ROOT / base).rglob("compose.yaml") if "node_modules" not in path.parts)
                files.extend(path for path in (ROOT / base).rglob(".env.example") if "node_modules" not in path.parts)
            files.append(ROOT / ".env.example")
            files.append(ROOT / "services/platform/esign-service/server/certs/certificate.p12")
            for file in files:
                target = root / file.relative_to(ROOT)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(file, target)
            env.copy_env(root)
            compliance = root / "services/core/compliance-service/.env"
            compliance.write_text(compliance.read_text().replace("DB_PASSWORD=SecurePassword5432", 'DB_PASSWORD="custom\'compliance@:%"'))
            compliance.write_text(compliance.read_text().replace(
                "S3_SECRET_KEY=local-compliance-password", "S3_SECRET_KEY='secret$with spaces'"))
            nats = root / ".auth-keys/nats"
            nats.mkdir(parents=True)
            for user in (*k8s.USERS, "broker"):
                (nats / f"{user}.env").write_text("TEST_VALUE=test\n")
            with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root):
                compose.main()
                pointer = (root / ".auth-keys/local").resolve()
                compose.main()
                self.assertEqual((root / ".auth-keys/local").resolve(), pointer)
            shared = json.loads((root / ".auth-keys/local/credentials.json").read_text())
            self.assertEqual(shared["compliance"]["DB_PASSWORD"], "custom'compliance@:%")
            self.assertEqual(set(shared["topology"]), {"DB_USER", "DB_PASSWORD"})
            self.assertEqual((root / ".auth-keys/local/credentials.json").stat().st_mode & 0o777, 0o600)
            overrides = {**os.environ, "DB_USER": "override", "DB_PASSWORD": "override",
                         "S3_ACCESS_KEY": "override", "S3_SECRET_KEY": "override",
                         "SIGNING_CERT_PASSWORD": "override"}
            result = subprocess.run(["docker", "compose", "-f", str(root / "compose.yaml"), "config", "--format", "json"],
                                    check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=overrides)
            services = json.loads(result.stdout)["services"]
            self.assertEqual(services["dbgate"]["environment"]["PASSWORD_compliance"], "custom'compliance@:%")
            self.assertEqual(services["compliance-db"]["environment"]["POSTGRES_PASSWORD"], shared["compliance"]["DB_ADMIN_PASSWORD"])
            self.assertEqual(services["compliance-server"]["environment"]["DB_PASSWORD"], "custom'compliance@:%")
            self.assertNotEqual(services["topology-server"]["environment"]["DB_PASSWORD"], "override")
            self.assertNotEqual(services["audit-server"]["environment"]["DB_PASSWORD"], "override")
            self.assertNotEqual(services["esign-server"]["environment"]["SIGNING_CERT_PASSWORD"], "override")
            for name in ("compliance", "audit", "esign", "pdf"):
                self.assertEqual(services[f"{name}-server"]["environment"]["S3_SECRET_KEY"].replace("$$", "$"), shared[name]["S3_SECRET_KEY"])
            self.assertEqual(shared["compliance"]["S3_SECRET_KEY"], "secret$with spaces")
            for name in ("topology", "compliance", "audit"):
                self.assertEqual(services[f"{name}-server"]["environment"]["DB_PASSWORD"], shared[name]["DB_PASSWORD"])
            self.assertNotEqual(services["minio"]["environment"]["MINIO_ROOT_USER"], services["compliance-server"]["environment"]["S3_ACCESS_KEY"])
            self.assertNotIn("MINIO_ROOT_PASSWORD", services["dbgate"]["environment"])
            self.assertNotIn("PASSWORD_compliance", services["minio"]["environment"])
            self.assertEqual(services["minio-setup"]["environment"]["COMPLIANCE_ACCESS_KEY"], shared["compliance"]["S3_ACCESS_KEY"])
            self.assertEqual(services["compliance-db-setup"]["environment"]["COMPLIANCE_RUNTIME_PASSWORD"], shared["compliance"]["DB_PASSWORD"])
            if subprocess.run(["docker", "image", "inspect", "nats:2.15-alpine"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                manifest = root / "runtime-check.yaml"
                manifest.write_text("services:\n  check:\n    image: nats:2.15-alpine\n"
                                    "    network_mode: none\n    env_file:\n"
                                    "      - .auth-keys/local/compliance-server.env\n")
                project = f"credential-check-{uuid4().hex}"
                command = ["docker", "compose", "-p", project, "-f", str(manifest)]
                try:
                    subprocess.run([*command, "create"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=overrides)
                    container = subprocess.run([*command, "ps", "-aq"], check=True, stdout=subprocess.PIPE, env=overrides).stdout.decode().strip()
                    result = subprocess.run(["docker", "inspect", container], check=True, stdout=subprocess.PIPE)
                    runtime = json.loads(result.stdout)[0]["Config"]["Env"]
                    self.assertIn("S3_SECRET_KEY=secret$with spaces", runtime)
                    self.assertIn("DB_PASSWORD=custom'compliance@:%", runtime)
                finally:
                    subprocess.run([*command, "down"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=overrides)
            audit_env = root / "services/core/audit-ledger/.env"
            audit_env.write_text(audit_env.read_text().replace("S3_ACCESS_KEY=local-audit", "S3_ACCESS_KEY=local-esign"))
            with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root):
                with self.assertRaisesRegex(ValueError, "distinct"):
                    compose.main()
            self.assertEqual((root / ".auth-keys/local").resolve(), pointer)
            audit_env.write_text(audit_env.read_text().replace("S3_ACCESS_KEY=local-esign", "S3_ACCESS_KEY=local-audit")
                                 .replace("DB_PASSWORD=SecurePassword5432", "DB_PASSWORD="))
            with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root):
                with self.assertRaisesRegex(ValueError, "DB_PASSWORD"):
                    compose.main()
            self.assertEqual((root / ".auth-keys/local").resolve(), pointer)
            audit_env.write_text(audit_env.read_text().replace("DB_PASSWORD=\n", "DB_PASSWORD=SecurePassword5432\n"))
            lock = root / ".auth-keys/.local-credentials.lock"
            lock.mkdir()
            with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root):
                with self.assertRaisesRegex(ValueError, "lock exists"):
                    compose.main()
            self.assertEqual((root / ".auth-keys/local").resolve(), pointer)

    def test_partial_nats_credential_set_is_not_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".auth-keys/nats"
            path.mkdir(parents=True)
            (path / "audit.password").write_text("existing")
            result = subprocess.run(["bash", str(ROOT / "scripts/dev-env/generate-nats-credentials.sh")],
                                    cwd=directory, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("incomplete", result.stderr)
            self.assertEqual((path / "audit.password").read_text(), "existing")
            self.assertFalse((path / "topology.password").exists())


class ResetSafetyTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("docker"), "docker is unavailable")
    def test_reset_removes_only_disposable_project_resources(self):
        if subprocess.run(["docker", "image", "inspect", "nats:2.15-alpine"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            self.skipTest("local NATS image is unavailable")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            project = f"reset-check-{uuid4().hex}"
            manifest = root / "compose.yaml"
            manifest.write_text("services:\n  broker:\n    image: nats:2.15-alpine\n"
                                "    network_mode: none\n    volumes:\n      - nats-data:/data\n"
                                "volumes:\n  nats-data:\n")
            command = ["docker", "compose", "-p", project, "-f", str(manifest)]
            try:
                subprocess.run([*command, "up", "-d"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                with patch.object(reset, "ROOT", root), patch.object(reset, "PROJECTS", (project,)), \
                     patch.object(sys, "argv", ["reset", "--project", project, "--execute"]), \
                     patch("builtins.input", return_value=f"reset {project}"):
                    reset.main()
                self.assertEqual(subprocess.run([*command, "ps", "-aq"], check=True, stdout=subprocess.PIPE).stdout, b"")
                self.assertNotEqual(subprocess.run(["docker", "volume", "inspect", f"{project}_nats-data"],
                                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode, 0)
            finally:
                subprocess.run([*command, "down", "--volumes"], check=True,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def test_refuses_unverifiable_volume_or_foreign_container(self):
        with patch.object(reset, "docker", side_effect=["", "project_data\n"]), \
             patch.object(reset, "inspect", side_effect=[[], [{"Name": "project_data"}]]):
            with self.assertRaisesRegex(ValueError, "Cannot verify"):
                reset.inventory("dsap-local")
        foreign = {"Config": {"Labels": {"com.docker.compose.project": "dsap-local",
                                        "com.docker.compose.project.working_dir": "/other"}}}
        with patch.object(reset, "docker", side_effect=["container\n", ""]), \
             patch.object(reset, "inspect", return_value=[foreign]):
            with self.assertRaisesRegex(ValueError, "not owned"):
                reset.inventory("dsap-local")

    def test_reset_requires_confirmation_and_stable_inventory(self):
        container = {"Id": "id", "Name": "/local", "State": {"Running": True}}
        volume = {"Name": "dsap-local_minio-data"}
        with patch.object(sys, "argv", ["reset", "--project", "dsap-local", "--execute"]), \
             patch.object(reset, "inventory", return_value=([container], [volume])), \
             patch("builtins.input", return_value="no"), patch.object(reset, "docker") as docker:
            with self.assertRaisesRegex(ValueError, "Confirmation"):
                reset.main()
            docker.assert_not_called()
        with patch.object(sys, "argv", ["reset", "--project", "dsap-local", "--execute"]), \
             patch.object(reset, "inventory", return_value=([container], [volume])), \
             patch("builtins.input", return_value="reset dsap-local"), patch.object(reset, "docker") as docker:
            reset.main()
            self.assertEqual([call.args for call in docker.call_args_list],
                             [("stop", "id"), ("rm", "id"), ("volume", "rm", "dsap-local_minio-data")])
        with patch.object(sys, "argv", ["reset", "--project", "dsap-local", "--execute"]), \
             patch.object(reset, "inventory", side_effect=[([container], [volume]), ([], [])]), \
             patch("builtins.input", return_value="reset dsap-local"), patch.object(reset, "docker") as docker:
            with self.assertRaisesRegex(ValueError, "inventory changed"):
                reset.main()
            docker.assert_not_called()


class LocalSecretTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("RUN_ISOLATED_K3D_TEST") == "1", "isolated k3d test not requested")
    def test_isolated_k3d_provisioning(self):
        project = f"credential-check-{uuid4().hex[:12]}"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script_dir = root / "scripts"
            script_dir.mkdir()
            shutil.copyfile(ROOT / ".env.example", root / ".env")
            for name in ("k8s-local-secrets.py", "prepare-local-compose.py",
                         "generate-nats-credentials.sh", "generate-auth-keys.sh"):
                shutil.copyfile(ROOT / "scripts" / name, script_dir / name)
            for name in ("topology-service", "compliance-service", "audit-ledger"):
                source = ROOT / "services/core" / name / ".env.example"
                target = root / "services/core" / name / ".env"
                target.parent.mkdir(parents=True)
                shutil.copyfile(source, target)
            for name in ("esign-service", "pdf-generator"):
                source = ROOT / "services/platform" / name / ".env.example"
                target = root / "services/platform" / name / ".env"
                target.parent.mkdir(parents=True)
                shutil.copyfile(source, target)
            cert = root / "services/platform/esign-service/server/certs/certificate.p12"
            cert.parent.mkdir(parents=True)
            shutil.copyfile(ROOT / "services/platform/esign-service/server/certs/certificate.p12", cert)
            environment = {**os.environ, "KUBECONFIG": str(root / "kubeconfig")}
            environment.pop("K8S_NAMESPACE", None)
            exists = subprocess.run(["k3d", "cluster", "get", project], env=environment,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if exists.returncode == 0:
                self.fail("Random test cluster name already exists")
            try:
                subprocess.run(["k3d", "cluster", "create", project, "--no-lb",
                                "--kubeconfig-update-default=false", "--kubeconfig-switch-context=false",
                                "--image", "rancher/k3s:v1.35.5-k3s1", "--wait", "--timeout", "120s"],
                               check=True, env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                config = subprocess.run(["k3d", "kubeconfig", "get", project], check=True,
                                        env=environment, stdout=subprocess.PIPE).stdout
                (root / "kubeconfig").write_bytes(config)
                subprocess.run(["kubectl", "config", "rename-context", f"k3d-{project}", "k3d-platform-cluster"],
                               check=True, env=environment, stdout=subprocess.PIPE)
                command = ["python3", str(script_dir / "k8s-local-secrets.py")]
                for _ in range(2):
                    subprocess.run(command, cwd=root, env=environment, check=True,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                secrets_result = subprocess.run(["kubectl", "-n", "platform-local", "get", "secrets", "-o", "json"],
                                                env=environment, check=True, stdout=subprocess.PIPE)
                secret_names = {item["metadata"]["name"] for item in json.loads(secrets_result.stdout)["items"]}
                self.assertIn("audit-db-credentials", secret_names)
                self.assertIn("nats-broker-credentials", secret_names)
                self.assertIn("esign-secrets", secret_names)
                audit = root / "services/core/audit-ledger/.env"
                audit.write_text(audit.read_text().replace("DB_PASSWORD=SecurePassword5432", "DB_PASSWORD=changed"))
                conflict = subprocess.run(command, cwd=root, env=environment,
                                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                self.assertNotEqual(conflict.returncode, 0)
                self.assertIn("conflicts", conflict.stderr)
            finally:
                subprocess.run(["k3d", "cluster", "delete", project], env=environment, check=True,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def test_postgres_credentials_are_url_encoded(self):
        # Synthetic URL-encoding fixture; no database uses these credentials.
        values = k8s.database_values("compliance", "user@name", "pass:/?#%")
        self.assertEqual(values["DATABASE_URL"], b"postgresql://user%40name:pass%3A%2F%3F%23%25@compliance-db:5432/compliance")

    def test_refuses_non_designated_kubernetes_context(self):
        with patch.object(k8s, "command", return_value=b"k3d-other\n"):
            with self.assertRaisesRegex(ValueError, "k3d-platform-cluster"):
                k8s.main()

    def test_env_parser_rejects_ambiguous_interpolation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            with patch.object(k8s, "ROOT", Path(directory)):
                path.write_text("PASSWORD='literal$character'\n")
                self.assertEqual(k8s.env_file(path)["PASSWORD"], "literal$character")
                path.write_text('PASSWORD="$OTHER"\n')
                with self.assertRaisesRegex(ValueError, "interpolated"):
                    k8s.env_file(path)

    def test_comparison_requires_matching_keys(self):
        k8s.compare("test", {"key": b"value", "extra": b"x"}, {"key": b"value"})
        with self.assertRaisesRegex(ValueError, "conflicts"):
            k8s.compare("test", {"key": b"old"}, {"key": b"new"})
        with self.assertRaisesRegex(ValueError, "missing required"):
            k8s.compare("test", {}, {"key": b"value"})

    def test_missing_secret_with_persistent_state_fails(self):
        with patch.object(k8s, "get_resource", side_effect=lambda kind, name: {"name": name} if kind == "pvc" else None):
            with self.assertRaisesRegex(ValueError, "recover"):
                k8s.check_empty_storage("db-credentials", "db")

    def test_secret_values_are_sent_on_stdin(self):
        with patch.object(k8s, "kubectl") as call:
            k8s.create_secret("test", {"password": b"sensitive"})
            self.assertEqual(call.call_args.args, ("create", "-f", "-"))
            self.assertNotIn(b"sensitive", call.call_args.kwargs["input"])

    def test_local_bootstrap_reuses_secrets_and_rejects_conflict(self):
        resources = {}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text("MINIO_ROOT_USER=rootuser\nMINIO_ROOT_PASSWORD=rootpassword\n")
            for name in ("topology-service", "compliance-service", "audit-ledger"):
                path = root / "services/core" / name
                path.mkdir(parents=True)
                (path / ".env").write_text(
                    f"DB_USER={name}-user\nDB_PASSWORD={name}-password\n"
                    f"DB_ADMIN_USER={name}-admin\nDB_ADMIN_PASSWORD={name}-admin-password\n"
                    f"S3_ACCESS_KEY={name}-s3\nS3_SECRET_KEY={name}-s3-password\n")
            esign = root / "services/platform/esign-service"
            (esign / "server/certs").mkdir(parents=True)
            (esign / ".env").write_text("S3_ACCESS_KEY=esign-user\nS3_SECRET_KEY=esign-password\nSIGNING_CERT_PASSWORD=localpass\n")
            (esign / "server/certs/certificate.p12").write_bytes(b"certificate")
            pdf = root / "services/platform/pdf-generator"
            pdf.mkdir(parents=True)
            (pdf / ".env").write_text("S3_ACCESS_KEY=pdf-user\nS3_SECRET_KEY=pdf-password\n")

            def fake_command(*args, input=None):
                if args[:2] == ("kubectl", "config"):
                    return b"k3d-platform-cluster\n"
                if args[0] == "python3" and "prepare-local-compose.py" in args[1]:
                    with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root), \
                         patch.object(compose.subprocess, "run") as verify:
                        verify.return_value.returncode = 0
                        verify.return_value.stdout = b""
                        compose.main()
                    return b""
                if args[0] == "bash" and "generate-nats-credentials.sh" in args[1]:
                    nats = root / ".auth-keys/nats"
                    nats.mkdir(parents=True, exist_ok=True)
                    for user in k8s.USERS:
                        (nats / f"{user}.password").write_text("password")
                        (nats / f"{user}.env").write_text(f"NATS_USER={user}\nNATS_PASSWORD=password\n")
                    (nats / "broker.env").write_text("".join(f"NATS_{user.upper()}_PASSWORD=password\n" for user in k8s.USERS))
                if args[0] == "bash" and "generate-auth-keys.sh" in args[1]:
                    auth = root / ".auth-keys"
                    auth.mkdir(exist_ok=True)
                    (auth / "private.pem").write_bytes(b"private")
                    (auth / "public.pem").write_bytes(b"public")
                if args[:2] == ("openssl", "pkey"):
                    return b"public"
                return b""

            def fake_get(kind, name):
                if kind == "secret" and name in resources:
                    import base64
                    return {"data": {key: base64.b64encode(value).decode() for key, value in resources[name].items()}}
                if kind == "namespace":
                    return {"name": name}
                return None

            def fake_create(name, values):
                self.assertNotIn(name, resources)
                resources[name] = values

            with patch.object(k8s, "ROOT", root), patch.object(k8s, "command", side_effect=fake_command), \
                 patch.object(k8s, "get_resource", side_effect=fake_get), patch.object(k8s, "create_secret", side_effect=fake_create):
                k8s.main()
                before = dict(resources)
                k8s.main()
                self.assertEqual(resources, before)
                resources["minio-audit-credentials"]["MINIO_ROOT_PASSWORD"] = b"unexpected"
                with self.assertRaisesRegex(ValueError, "administrator keys"):
                    k8s.main()
                del resources["minio-audit-credentials"]["MINIO_ROOT_PASSWORD"]
                audit_env = root / "services/core/audit-ledger/.env"
                audit_env.write_text(audit_env.read_text().replace("DB_PASSWORD=audit-ledger-password", "DB_PASSWORD=changed"))
                with self.assertRaisesRegex(ValueError, "conflicts"):
                    k8s.main()
                self.assertEqual(resources, before)


class DemoSecretTests(unittest.TestCase):
    def test_signing_certificate_fingerprint_without_local_certificate(self):
        import hashlib

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            decoded = demo._decode_bundle(demo.generate(root))
            cert = root / "services/platform/esign-service/server/certs/certificate.p12"
            cert.parent.mkdir(parents=True)
            fingerprint = cert.with_suffix(".p12.sha256")
            with patch.object(demo, "ROOT", root):
                with self.assertRaisesRegex(ValueError, "fingerprint is required"):
                    demo._validate_demo_material(decoded)
                fingerprint.write_text("invalid\n")
                with self.assertRaisesRegex(ValueError, "Invalid.*fingerprint"):
                    demo._validate_demo_material(decoded)
                fingerprint.write_text(hashlib.sha256(decoded["esign-secrets"]["certificate.p12"]).hexdigest())
                with self.assertRaisesRegex(ValueError, "tracked local PDF certificate"):
                    demo._validate_demo_material(decoded)
                fingerprint.write_text(hashlib.sha256(b"different certificate").hexdigest() + "\n")
                demo._validate_demo_material(decoded)
                cert.write_bytes(decoded["esign-secrets"]["certificate.p12"])
                with self.assertRaisesRegex(ValueError, "tracked local PDF certificate"):
                    demo._validate_demo_material(decoded)

    def test_access_model_upgrade_preserves_existing_material(self):
        import base64
        import copy

        with tempfile.TemporaryDirectory() as directory:
            bundle = demo.generate(Path(directory))
            bundle["compliance-db-credentials"]["extra"] = base64.b64encode(b"preserved").decode()
            original = copy.deepcopy(bundle)
            upgraded = demo.upgrade_access_model(bundle)
            self.assertEqual(bundle, original)
            self.assertEqual(set(upgraded), set(demo.ACCESS_MODEL_NAMES))
            for name in set(demo.NAMES) - {"compliance-db-credentials", "audit-db-credentials", "minio-credentials"}:
                self.assertEqual(upgraded[name], original[name])
            self.assertEqual(upgraded["compliance-db-credentials"]["extra"], original["compliance-db-credentials"]["extra"])
            self.assertEqual(upgraded["compliance-db-admin-credentials"]["POSTGRES_USER"],
                             original["compliance-db-credentials"]["POSTGRES_USER"])
            self.assertEqual(upgraded["compliance-db-admin-credentials"]["POSTGRES_PASSWORD"],
                             original["compliance-db-credentials"]["POSTGRES_PASSWORD"])
            self.assertEqual(upgraded["audit-db-admin-credentials"]["MONGO_INITDB_ROOT_USERNAME"],
                             original["audit-db-credentials"]["DB_USER"])
            self.assertEqual(upgraded["audit-db-admin-credentials"]["MONGO_INITDB_ROOT_PASSWORD"],
                             original["audit-db-credentials"]["DB_PASSWORD"])
            self.assertEqual(upgraded["minio-credentials"]["MINIO_ROOT_USER"],
                             original["minio-credentials"]["MINIO_ROOT_USER"])
            self.assertEqual(upgraded["minio-credentials"]["MINIO_ROOT_PASSWORD"],
                             original["minio-credentials"]["MINIO_ROOT_PASSWORD"])
            self.assertNotIn("S3_SECRET_KEY", upgraded["minio-credentials"])
            names = ("compliance", "audit", "esign", "pdf")
            keys = [upgraded[f"minio-{name}-credentials"]["S3_ACCESS_KEY"] for name in names]
            passwords = [upgraded[f"minio-{name}-credentials"]["S3_SECRET_KEY"] for name in names]
            self.assertEqual(len(set(keys)), 4)
            self.assertEqual(len(set(passwords)), 4)
            self.assertTrue(all(len(base64.b64decode(value)) >= 32 for value in passwords))
            self.assertNotEqual(upgraded["compliance-db-credentials"]["DB_USER"],
                                original["compliance-db-credentials"]["DB_USER"])
            self.assertNotEqual(upgraded["audit-db-credentials"]["DB_USER"],
                                original["audit-db-credentials"]["DB_USER"])
            demo.validate_access_model(upgraded)
            upgraded["minio-audit-credentials"]["S3_SECRET_KEY"] = upgraded["minio-credentials"]["MINIO_ROOT_PASSWORD"]
            with self.assertRaisesRegex(ValueError, "distinct"):
                demo.validate_access_model(upgraded)

    def test_create_reuse_and_conflict(self):
        resources = {}

        def fake_get(context, namespace, kind, name):
            return resources.get(name) if kind == "secret" else None

        def fake_kubectl(context, namespace, *args, input=None):
            if args[:2] == ("create", "-f"):
                item = json.loads(input)
                resources[item["metadata"]["name"]] = item
            return b""

        with tempfile.TemporaryDirectory() as directory:
            argv = ["demo", "--context", "test-context", "--namespace", "demo", "--dir", directory, "--init"]
            with patch.object(demo, "get", side_effect=fake_get), patch.object(demo, "kubectl", side_effect=fake_kubectl), patch("sys.argv", argv):
                demo.main()
                path = Path(directory) / "demo-secrets.json"
                original = path.read_bytes()
                self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
                self.assertEqual(set(resources), set(demo.ACCESS_MODEL_NAMES))
                demo.main()
                self.assertEqual(path.read_bytes(), original)
                resources["audit-db-credentials"]["data"]["DB_PASSWORD"] = "d3Jvbmc="
                with self.assertRaisesRegex(ValueError, "conflicts"):
                    demo.main()
                self.assertEqual(path.read_bytes(), original)
                argv[2] = "other-context"
                with self.assertRaisesRegex(ValueError, "different context"):
                    demo.main()

    def test_existing_storage_prevents_initialization(self):
        with tempfile.TemporaryDirectory() as directory:
            argv = ["demo", "--context", "ctx", "--namespace", "demo", "--dir", directory, "--init"]
            with patch.object(demo, "get", side_effect=lambda c, n, k, name: {"name": name} if k == "pvc" else None), \
                 patch.object(demo, "kubectl", return_value=b""), patch("sys.argv", argv):
                with self.assertRaisesRegex(ValueError, "recover"):
                    demo.main()
                self.assertFalse((Path(directory) / "demo-secrets.json").exists())

    def test_explicit_upgrade_resumes_and_preserves_backup(self):
        resources = {}
        interrupted = [False]
        storage = [True]

        def fake_get(context, namespace, kind, name):
            if kind == "secret":
                return resources.get(name)
            return {"name": name} if storage[0] and kind == "pvc" and name == "compliance-db" else None

        def fake_kubectl(context, namespace, *args, input=None):
            if args[:2] in (("create", "-f"), ("replace", "-f")):
                item = json.loads(input)
                name = item["metadata"]["name"]
                if name == "audit-db-admin-credentials" and not interrupted[0]:
                    interrupted[0] = True
                    raise subprocess.CalledProcessError(1, args)
                resources[name] = item
            return b""

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "demo-secrets.json"
            legacy = {"version": 1, "context": "ctx", "namespace": "demo",
                      "secrets": demo.generate(Path(directory))}
            path.write_text(json.dumps(legacy))
            os.chmod(path, 0o600)
            original = path.read_bytes()
            for name, data in legacy["secrets"].items():
                resources[name] = {"apiVersion": "v1", "kind": "Secret",
                                   "metadata": {"name": name, "resourceVersion": "1"}, "data": data}
            argv = ["demo", "--context", "ctx", "--namespace", "demo", "--dir", directory, "--upgrade-access-model"]
            with patch.object(demo, "get", side_effect=fake_get), \
                 patch.object(demo, "kubectl", side_effect=fake_kubectl), patch("sys.argv", argv):
                with self.assertRaisesRegex(ValueError, "storage or deployment exists"):
                    demo.main()
                self.assertEqual(path.read_bytes(), original)
                self.assertFalse(path.with_name("demo-secrets-v1.backup.json").exists())
                storage[0] = False
                with self.assertRaises(subprocess.CalledProcessError):
                    demo.main()
                self.assertEqual(path.read_bytes(), original)
                self.assertEqual(path.with_name("demo-secrets-v1.backup.json").read_bytes(), original)
                staged = json.loads(path.with_name("demo-secrets-upgrade.json").read_text())
                demo.main()
                upgraded = json.loads(path.read_text())
                self.assertEqual(upgraded["version"], 2)
                self.assertEqual(upgraded["secrets"], staged["secrets"])
                self.assertEqual(set(resources), set(demo.ACCESS_MODEL_NAMES))
                self.assertFalse(path.with_name("demo-secrets-upgrade.json").exists())
                demo.main()
                self.assertEqual(json.loads(path.read_text()), upgraded)


if __name__ == "__main__":
    unittest.main()
