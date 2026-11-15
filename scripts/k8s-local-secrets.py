#!/usr/bin/env python3
"""Provision local Kubernetes credentials without rotating existing secrets."""

import base64
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
NAMESPACE = os.environ.get("K8S_NAMESPACE", "platform-local")
USERS = ("compliance", "topology", "audit", "esign", "pdf")


def command(*args, input=None):
    return subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout


def kubectl(*args, input=None):
    return command("kubectl", "--namespace", NAMESPACE, *args, input=input)


def get_resource(kind, name):
    output = kubectl("get", kind, name, "--ignore-not-found", "-o", "json")
    return json.loads(output) if output else None


def get_secret(name):
    resource = get_resource("secret", name)
    if resource is None:
        return None
    return {key: base64.b64decode(value, validate=True) for key, value in resource.get("data", {}).items()}


def parse_env_value(path, number, name, value):
    value = value.strip()
    if value.startswith(("'", '"')):
        quote_char = value[0]
        contents = value[1:-1]
        if len(value) < 2 or value[-1] != quote_char or quote_char in contents or "\\" in contents:
            raise ValueError(f"{path.relative_to(ROOT)}:{number}: unsupported quoted value for {name}")
        if quote_char == '"' and "$" in contents:
            raise ValueError(f"{path.relative_to(ROOT)}:{number}: interpolated value is not supported for {name}")
        return contents
    if any(character.isspace() or character in "'\"\\$" for character in value):
        raise ValueError(f"{path.relative_to(ROOT)}:{number}: unsupported unquoted value for {name}")
    return value


def env_file(path):
    result = {}
    if not path.exists():
        return result
    for number, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"(?:export\s+)?([A-Za-z_]\w*)\s*=(.*)", line)
        if not match or match[1] in result:
            raise ValueError(f"{path.relative_to(ROOT)}:{number}: invalid or duplicate variable")
        result[match[1]] = parse_env_value(path, number, match[1], match[2])
    return result


def encode(values):
    return {key: value if isinstance(value, bytes) else value.encode() for key, value in values.items()}


def require_keys(name, value, keys):
    missing = [key for key in keys if not value.get(key)]
    if missing:
        raise ValueError(f"Existing Secret {name} is missing required keys: {', '.join(missing)}")


def compare(name, current, expected):
    require_keys(name, current, expected)
    differing = [key for key, value in expected.items() if current[key] != value]
    if differing:
        raise ValueError(f"Secret {name} conflicts with local settings ({', '.join(differing)}); no secrets changed.")


def check_empty_storage(secret, workload):
    if get_resource("pvc", workload) or get_resource("deployment", workload):
        raise ValueError(f"Secret {secret} is missing while {workload} storage or deployment exists; recover its credentials before retrying.")


def create_secret(name, values):
    body = {
        "apiVersion": "v1", "kind": "Secret",
        "metadata": {"name": name, "namespace": NAMESPACE},
        "type": "Opaque",
        "data": {key: base64.b64encode(value).decode() for key, value in values.items()},
    }
    kubectl("create", "-f", "-", input=json.dumps(body).encode())
    print(f"Created Secret {name}/{NAMESPACE}.")


def database_credentials(name, workload, local, existing):
    if existing:
        require_keys(name, existing, ("DB_USER", "DB_PASSWORD"))
    else:
        check_empty_storage(name, workload)
    return local["DB_USER"], local["DB_PASSWORD"]


def database_values(service, username, password):
    values = {"DB_USER": username, "DB_PASSWORD": password}
    if service == "topology":
        if "/" in username or "/" in password:
            raise ValueError("Neo4j username/password cannot contain '/'.")
        values["NEO4J_AUTH"] = f"{username}/{password}"
    if service == "compliance":
        values["DATABASE_URL"] = f"postgresql://{quote(username, safe='')}:{quote(password, safe='')}@compliance-db:5432/compliance"
    return encode(values)


def _validate_database_secret(service, name, existing, values):
    legacy_keys = {
        "compliance": ("POSTGRES_USER", "POSTGRES_PASSWORD"),
        "audit": ("MONGO_INITDB_ROOT_USERNAME", "MONGO_INITDB_ROOT_PASSWORD"),
    }
    if any(key in existing for key in legacy_keys.get(service, ())):
        if service == "compliance":
            raise ValueError("Legacy compliance-db-credentials contains administrator keys; explicitly recover or reset local state before upgrading.")
        raise ValueError("audit-db-credentials contains administrator keys; explicitly recover or reset local state before upgrading.")
    compare(name, existing, values)


def _provision_database_admin(service, workload, local, current, pending):
    admin_name = f"{service}-db-admin-credentials"
    if service == "compliance":
        admin_values = encode({"POSTGRES_USER": local["DB_ADMIN_USER"],
                               "POSTGRES_PASSWORD": local["DB_ADMIN_PASSWORD"], "POSTGRES_DB": "compliance"})
    else:
        admin_values = encode({"MONGO_INITDB_ROOT_USERNAME": local["DB_ADMIN_USER"],
                               "MONGO_INITDB_ROOT_PASSWORD": local["DB_ADMIN_PASSWORD"]})
    admin = current[admin_name]
    if admin:
        compare(admin_name, admin, admin_values)
        return
    check_empty_storage(admin_name, workload)
    pending[admin_name] = admin_values


def provision_databases(current, local_values):
    pending = {}
    databases = (
        ("topology", "topology-db"),
        ("compliance", "compliance-db"),
        ("audit", "audit-db"),
    )
    for service, workload in databases:
        name = f"{service}-db-credentials"
        local = local_values[service]
        existing = current[name]
        username, password = database_credentials(name, workload, local, existing)
        values = database_values(service, username, password)
        if existing:
            _validate_database_secret(service, name, existing, values)
        else:
            pending[name] = values
        if service in ("compliance", "audit"):
            _provision_database_admin(service, workload, local, current, pending)
    return pending


def minio_credentials(name, local, existing):
    if existing:
        require_keys(name, existing, ("MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD"))
    else:
        check_empty_storage(name, "minio")
    return local["MINIO_ROOT_USER"], local["MINIO_ROOT_PASSWORD"]


def validate_minio_deployment(existing):
    deployment = get_resource("deployment", "minio")
    if not deployment:
        return
    for container in deployment["spec"]["template"]["spec"]["containers"]:
        for entry in container.get("env", []):
            if entry["name"] in ("MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD") and "value" in entry:
                if entry["value"].encode() != existing[entry["name"]]:
                    raise ValueError("Existing MinIO deployment credentials differ from minio-credentials; reconcile them before upgrading.")


def provision_minio(current, local_values):
    pending = {}
    local = local_values["platform"]
    name = "minio-credentials"
    existing = current[name]
    user, password = minio_credentials(name, local, existing)
    values = encode({"MINIO_ROOT_USER": user, "MINIO_ROOT_PASSWORD": password})
    if existing:
        if any(key in existing for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY")):
            raise ValueError("Legacy minio-credentials contains application keys; explicitly recover or reset local state before upgrading.")
        compare(name, existing, values)
        validate_minio_deployment(existing)
    else:
        pending[name] = values
    for service in ("compliance", "audit", "esign", "pdf"):
        service_name = f"minio-{service}-credentials"
        service_values = encode({key: local_values[service][key] for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY")})
        if current[service_name]:
            if any(key in current[service_name] for key in ("MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD")):
                raise ValueError(f"Secret {service_name} contains MinIO administrator keys; recover it before retrying.")
            compare(service_name, current[service_name], service_values)
        else:
            check_empty_storage(service_name, "minio")
            check_empty_storage(service_name, f"{service}-server")
            pending[service_name] = service_values
    return pending, local_values["esign"]


def validate_nats_credentials(current, nats_dir):
    has_existing = any(current[f"nats-{user}-credentials"] for user in USERS)
    has_existing = has_existing or bool(current["nats-broker-credentials"])
    if has_existing:
        if not all((nats_dir / f"{user}.password").is_file() for user in USERS):
            raise ValueError("Existing NATS Secrets require the matching local credential files; recover them before retrying.")
        return
    check_empty_storage("nats-broker-credentials", "nats")


def provision_nats(current):
    pending = {}
    nats_dir = ROOT / ".auth-keys/nats"
    validate_nats_credentials(current, nats_dir)
    command("bash", str(ROOT / "scripts/generate-nats-credentials.sh"))
    nats = {"nats-broker-credentials": encode(env_file(nats_dir / "broker.env"))}
    nats.update({f"nats-{user}-credentials": encode(env_file(nats_dir / f"{user}.env")) for user in USERS})
    for name, values in nats.items():
        if current[name]:
            compare(name, current[name], values)
        else:
            pending[name] = values
    return pending


def _validate_legacy_auth_keys(current, private, public):
    if private.exists() != public.exists():
        raise ValueError("Auth key pair is incomplete; recover the missing key before retrying.")
    if not private.exists() and (current["auth-signing-key"] or current["auth-public-key"]):
        raise ValueError("Existing auth Secrets require the matching local key pair; recover it before retrying.")
    if bool(current["auth-signing-key"]) != bool(current["auth-public-key"]):
        raise ValueError("Kubernetes auth Secret pair is incomplete; recover it before retrying.")
    if not current["auth-signing-key"]:
        check_empty_storage("auth-signing-key", "auth-server")
        for workload in ("topology-server", "compliance-server", "audit-server"):
            if get_resource("deployment", workload):
                raise ValueError(f"Auth Secrets are missing while {workload} exists; recover them before retrying.")


def _add_legacy_auth_secret(name, values, current, pending):
    if current[name]:
        compare(name, current[name], values)
    else:
        pending[name] = values


def _legacy_provision_nats_auth_block(current, pending):
    private = ROOT / ".auth-keys/private.pem"
    public = ROOT / ".auth-keys/public.pem"
    _validate_legacy_auth_keys(current, private, public)
    if not private.exists():
        command("bash", str(ROOT / "scripts/generate-auth-keys.sh"))
    derived = command("openssl", "pkey", "-in", str(private), "-pubout")
    if derived != public.read_bytes():
        raise ValueError("Local auth public and private keys do not match.")
    for name, values in (("auth-signing-key", {"private.pem": private.read_bytes()}),
                         ("auth-public-key", {"public.pem": public.read_bytes()})):
        _add_legacy_auth_secret(name, values, current, pending)


def prepare_auth_keys(current):
    private = ROOT / ".auth-keys/private.pem"
    public = ROOT / ".auth-keys/public.pem"
    if private.exists() != public.exists():
        raise ValueError("Auth key pair is incomplete; recover the missing key before retrying.")
    if not private.exists() and (current["auth-signing-key"] or current["auth-public-key"]):
        raise ValueError("Existing auth Secrets require the matching local key pair; recover it before retrying.")
    if bool(current["auth-signing-key"]) != bool(current["auth-public-key"]):
        raise ValueError("Kubernetes auth Secret pair is incomplete; recover it before retrying.")
    if not current["auth-signing-key"]:
        check_empty_storage("auth-signing-key", "auth-server")
        for workload in ("topology-server", "compliance-server", "audit-server"):
            if get_resource("deployment", workload):
                raise ValueError(f"Auth Secrets are missing while {workload} exists; recover them before retrying.")
    if not private.exists():
        command("bash", str(ROOT / "scripts/generate-auth-keys.sh"))
    derived = command("openssl", "pkey", "-in", str(private), "-pubout")
    if derived != public.read_bytes():
        raise ValueError("Local auth public and private keys do not match.")
    return private, public


def provision_auth(current, private, public):
    pending = {}
    for name, values in (("auth-signing-key", {"private.pem": private.read_bytes()}),
                         ("auth-public-key", {"public.pem": public.read_bytes()})):
        if current[name]:
            compare(name, current[name], values)
        else:
            pending[name] = values
    return pending


def provision_esign(current, local):
    pending = {}
    name = "esign-secrets"
    if not current[name]:
        check_empty_storage(name, "esign-server")
    cert = ROOT / "services/platform/esign-service/server/certs/certificate.p12"
    password = local["SIGNING_CERT_PASSWORD"]
    if not cert.is_file():
        raise ValueError("Local PDF signing certificate is missing; restore it before retrying.")
    command("openssl", "pkcs12", "-in", str(cert), "-noout", "-passin", "stdin", input=(password + "\n").encode())
    values = encode({"certificate.p12": cert.read_bytes(), "SIGNING_CERT_PASSWORD": password})
    if current[name]:
        compare(name, current[name], values)
    else:
        pending[name] = values
    return pending


def main():
    context = command("kubectl", "config", "current-context").decode().strip()
    if context != "k3d-platform-cluster" or NAMESPACE != "platform-local":
        raise ValueError("Local secret bootstrap requires context k3d-platform-cluster and namespace platform-local; refusing other targets.")
    command("python3", str(ROOT / "scripts/prepare-local-compose.py"))
    local_values = json.loads((ROOT / ".auth-keys/local/credentials.json").read_text())
    if not get_resource("namespace", NAMESPACE):
        command("kubectl", "create", "namespace", NAMESPACE)
    names = ["topology-db-credentials", "compliance-db-credentials", "audit-db-credentials",
             "compliance-db-admin-credentials", "audit-db-admin-credentials",
             "minio-credentials", "esign-secrets", "auth-signing-key", "auth-public-key",
             "nats-broker-credentials"] + [f"nats-{user}-credentials" for user in USERS] \
             + [f"minio-{user}-credentials" for user in ("compliance", "audit", "esign", "pdf")]
    current = {name: get_secret(name) for name in names}
    pending = provision_databases(current, local_values)
    minio_pending, local = provision_minio(current, local_values)
    pending.update(minio_pending)
    pending.update(provision_nats(current))
    private, public = prepare_auth_keys(current)
    pending.update(provision_auth(current, private, public))
    pending.update(provision_esign(current, local))

    for name, values in pending.items():
        create_secret(name, values)
    print(f"Local secrets in {NAMESPACE} are available; existing secrets were not changed.")


if __name__ == "__main__":
    os.chdir(ROOT)
    try:
        main()
    except subprocess.CalledProcessError as error:
        detail = error.stderr.decode(errors="replace").strip() if error.stderr else str(error)
        print(f"Local secret provisioning failed: {detail}", file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError) as error:
        print(f"Local secret provisioning failed: {error}", file=sys.stderr)
        sys.exit(1)
