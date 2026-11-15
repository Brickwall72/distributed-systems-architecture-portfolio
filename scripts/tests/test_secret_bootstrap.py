import importlib.util
import json
import os
from pathlib import Path
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


env = load("copy_env", "copy-env.py")
k8s = load("k8s_local_secrets", "k8s-local-secrets.py")
demo = load("k8s_demo_secrets", "k8s-demo-secrets.py")
compose = load("prepare_local_compose", "prepare-local-compose.py")
reset = load("reset_local_compose", "reset-local-compose.py")


class EnvironmentMergeTests(unittest.TestCase):
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
            for path in (root / "services/core/compliance-service/.env", root / "services/core/audit-ledger/.env",
                         root / "services/platform/esign-service/.env", root / "services/platform/pdf-generator/.env"):
                path.write_text(path.read_text().replace("S3_SECRET_KEY=minioadmin", "S3_SECRET_KEY='secret$with spaces'"))
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
            self.assertEqual(services["compliance-db"]["environment"]["POSTGRES_PASSWORD"], "custom'compliance@:%")
            self.assertEqual(services["compliance-server"]["environment"]["DB_PASSWORD"], "custom'compliance@:%")
            self.assertNotEqual(services["topology-server"]["environment"]["DB_PASSWORD"], "override")
            self.assertNotEqual(services["audit-server"]["environment"]["DB_PASSWORD"], "override")
            self.assertNotEqual(services["esign-server"]["environment"]["SIGNING_CERT_PASSWORD"], "override")
            for name in ("compliance", "audit", "esign", "pdf"):
                self.assertEqual(services[f"{name}-server"]["environment"]["S3_SECRET_KEY"].replace("$$", "$"), shared[name]["S3_SECRET_KEY"])
                self.assertEqual(shared[name]["S3_SECRET_KEY"], "secret$with spaces")
            for name in ("topology", "compliance", "audit"):
                self.assertEqual(services[f"{name}-server"]["environment"]["DB_PASSWORD"], shared[name]["DB_PASSWORD"])
            self.assertEqual(services["minio"]["environment"]["MINIO_ROOT_USER"], services["compliance-server"]["environment"]["S3_ACCESS_KEY"])
            self.assertNotIn("MINIO_ROOT_PASSWORD", services["dbgate"]["environment"])
            self.assertNotIn("PASSWORD_compliance", services["minio"]["environment"])
            self.assertIn("${MINIO_ROOT_USER}", services["minio-setup"]["entrypoint"][-1])
            self.assertIn('"${MINIO_ROOT_PASSWORD}"', services["minio-setup"]["entrypoint"][-1].replace("$$", "$"))
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
            audit_env.write_text(audit_env.read_text().replace("S3_ACCESS_KEY=minioadmin", "S3_ACCESS_KEY=drift"))
            with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root):
                with self.assertRaisesRegex(ValueError, "differ"):
                    compose.main()
            self.assertEqual((root / ".auth-keys/local").resolve(), pointer)
            audit_env.write_text(audit_env.read_text().replace("S3_ACCESS_KEY=drift", "S3_ACCESS_KEY=minioadmin")
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
            result = subprocess.run(["bash", str(ROOT / "scripts/generate-nats-credentials.sh")],
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
            for name in ("topology-service", "compliance-service", "audit-ledger"):
                path = root / "services/core" / name
                path.mkdir(parents=True)
                (path / ".env").write_text("DB_USER=user\nDB_PASSWORD=password\nS3_ACCESS_KEY=localuser\nS3_SECRET_KEY=localpassword\n")
            esign = root / "services/platform/esign-service"
            (esign / "server/certs").mkdir(parents=True)
            (esign / ".env").write_text("S3_ACCESS_KEY=localuser\nS3_SECRET_KEY=localpassword\nSIGNING_CERT_PASSWORD=localpass\n")
            (esign / "server/certs/certificate.p12").write_bytes(b"certificate")
            pdf = root / "services/platform/pdf-generator"
            pdf.mkdir(parents=True)
            (pdf / ".env").write_text("S3_ACCESS_KEY=localuser\nS3_SECRET_KEY=localpassword\n")

            def fake_command(*args, input=None):
                if args[:2] == ("kubectl", "config"):
                    return b"k3d-platform-cluster\n"
                if args[0] == "python3" and "prepare-local-compose.py" in args[1]:
                    with patch.object(compose, "ROOT", root), patch.object(compose.local, "ROOT", root), \
                         patch.object(compose.subprocess, "run") as verify:
                        verify.return_value.returncode = 0
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
                (root / "services/core/audit-ledger/.env").write_text(
                    "DB_USER=user\nDB_PASSWORD=changed\nS3_ACCESS_KEY=localuser\nS3_SECRET_KEY=localpassword\n")
                with self.assertRaisesRegex(ValueError, "conflicts"):
                    k8s.main()
                self.assertEqual(resources, before)


class DemoSecretTests(unittest.TestCase):
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
                self.assertEqual(set(resources), set(demo.NAMES))
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


if __name__ == "__main__":
    unittest.main()
