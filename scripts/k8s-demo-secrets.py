#!/usr/bin/env python3
"""Generate and provision a separate set of fictional-demo Kubernetes secrets."""

import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent.parent
PRIVATE_KEY_FILENAME = "private.pem"
PUBLIC_KEY_FILENAME = "public.pem"
CERTIFICATE_FILENAME = "certificate.p12"
spec = importlib.util.spec_from_file_location("local_secrets", ROOT / "scripts/k8s-local-secrets.py")
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)

NAMES = ["topology-db-credentials", "compliance-db-credentials", "audit-db-credentials",
         "minio-credentials", "esign-secrets", "auth-signing-key", "auth-public-key",
         "nats-broker-credentials"] + [f"nats-{user}-credentials" for user in local.USERS]


def run(*args, input=None):
    return subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout


def kubectl(context, namespace, *args, input=None):
    return run("kubectl", "--context", context, "--namespace", namespace, *args, input=input)


def get(context, namespace, kind, name):
    output = kubectl(context, namespace, "get", kind, name, "--ignore-not-found", "-o", "json")
    return json.loads(output) if output else None


def generate(directory):
    with tempfile.TemporaryDirectory(prefix=".generate-", dir=directory) as tmp:
        temp = Path(tmp)
        private, public = temp / PRIVATE_KEY_FILENAME, temp / PUBLIC_KEY_FILENAME
        certificate, key, bundle = temp / "cert.pem", temp / "cert.key", temp / CERTIFICATE_FILENAME
        password_file = temp / "password"
        password = secrets.token_hex(32)
        password_file.write_text(password + "\n")
        os.chmod(password_file, 0o600)
        run("openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", str(private))
        public.write_bytes(run("openssl", "pkey", "-in", str(private), "-pubout"))
        run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "3650",
            "-subj", "/CN=Fictional Portfolio Demo Signing Certificate", "-keyout", str(key), "-out", str(certificate))
        run("openssl", "pkcs12", "-export", "-inkey", str(key), "-in", str(certificate),
            "-out", str(bundle), "-passout", f"file:{password_file}")
        db_passwords = {name: secrets.token_hex(32) for name in ("topology", "compliance", "audit")}
        s3_user, s3_password = "demo" + secrets.token_hex(12), secrets.token_hex(32)
        nats = {name: secrets.token_hex(32) for name in local.USERS}
        values = {
            "topology-db-credentials": {"DB_USER": "neo4j", "DB_PASSWORD": db_passwords["topology"],
                                        "NEO4J_AUTH": f"neo4j/{db_passwords['topology']}"},
            "compliance-db-credentials": {"DB_USER": "compliance", "DB_PASSWORD": db_passwords["compliance"],
                                          "POSTGRES_USER": "compliance", "POSTGRES_PASSWORD": db_passwords["compliance"],
                                          "POSTGRES_DB": "compliance", "DATABASE_URL":
                                          f"postgresql://compliance:{quote(db_passwords['compliance'], safe='')}@compliance-db:5432/compliance"},
            "audit-db-credentials": {"DB_USER": "audit", "DB_PASSWORD": db_passwords["audit"]},
            "minio-credentials": {"MINIO_ROOT_USER": s3_user, "MINIO_ROOT_PASSWORD": s3_password,
                                  "S3_ACCESS_KEY": s3_user, "S3_SECRET_KEY": s3_password},
            "esign-secrets": {"SIGNING_CERT_PASSWORD": password, "certificate.p12": bundle.read_bytes()},
            "auth-signing-key": {PRIVATE_KEY_FILENAME: private.read_bytes()},
            "auth-public-key": {PUBLIC_KEY_FILENAME: public.read_bytes()},
            "nats-broker-credentials": {f"NATS_{name.upper()}_PASSWORD": value for name, value in nats.items()},
        }
        values.update({f"nats-{name}-credentials": {"NATS_USER": name, "NATS_PASSWORD": nats[name]} for name in local.USERS})
        return {name: {key: base64.b64encode(value if isinstance(value, bytes) else value.encode()).decode()
                       for key, value in entries.items()} for name, entries in values.items()}


def _decode_bundle(bundle):
    if set(bundle) != set(NAMES):
        raise ValueError("Demo bundle has missing or unexpected Secret entries.")
    decoded = {name: {key: base64.b64decode(value, validate=True) for key, value in values.items()}
               for name, values in bundle.items()}
    for name in NAMES:
        if not decoded[name] or any(not value for value in decoded[name].values()):
            raise ValueError(f"Demo bundle has empty values for {name}.")
    return decoded


def _validate_required_keys(decoded):
    for name, keys in {
        "topology-db-credentials": ("DB_USER", "DB_PASSWORD", "NEO4J_AUTH"),
        "compliance-db-credentials": ("DB_USER", "DB_PASSWORD", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "DATABASE_URL"),
        "audit-db-credentials": ("DB_USER", "DB_PASSWORD"),
        "minio-credentials": ("MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY"),
        "esign-secrets": ("SIGNING_CERT_PASSWORD", CERTIFICATE_FILENAME),
        "auth-signing-key": (PRIVATE_KEY_FILENAME,),
        "auth-public-key": (PUBLIC_KEY_FILENAME,),
        "nats-broker-credentials": tuple(f"NATS_{user.upper()}_PASSWORD" for user in local.USERS),
    }.items():
        local.require_keys(name, decoded[name], keys)


def _validate_nats_credentials(decoded):
    for user in local.USERS:
        name = f"nats-{user}-credentials"
        local.require_keys(name, decoded[name], ("NATS_USER", "NATS_PASSWORD"))
        if (decoded[name]["NATS_USER"] != user.encode() or len(decoded[name]["NATS_PASSWORD"]) < 32 or
                decoded[name]["NATS_PASSWORD"] != decoded["nats-broker-credentials"][f"NATS_{user.upper()}_PASSWORD"]):
            raise ValueError(f"Demo NATS credentials for {user} are inconsistent.")


def _validate_database_credentials(decoded):
    for name in ("topology", "compliance", "audit"):
        if len(decoded[f"{name}-db-credentials"]["DB_PASSWORD"]) < 32:
            raise ValueError(f"Demo {name} database password is too short.")
    topology = decoded["topology-db-credentials"]
    if topology["NEO4J_AUTH"] != topology["DB_USER"] + b"/" + topology["DB_PASSWORD"]:
        raise ValueError("Demo Neo4j credentials are inconsistent.")
    compliance = decoded["compliance-db-credentials"]
    expected_url = ("postgresql://" + quote(compliance["DB_USER"].decode(), safe="") + ":" +
                    quote(compliance["DB_PASSWORD"].decode(), safe="") + "@compliance-db:5432/compliance").encode()
    if (compliance["DB_USER"] != compliance["POSTGRES_USER"] or
            compliance["DB_PASSWORD"] != compliance["POSTGRES_PASSWORD"] or
            compliance["POSTGRES_DB"] != b"compliance" or compliance["DATABASE_URL"] != expected_url):
        raise ValueError("Demo PostgreSQL credentials are inconsistent.")


def _validate_minio_credentials(decoded):
    s3 = decoded["minio-credentials"]
    if s3["MINIO_ROOT_USER"] != s3["S3_ACCESS_KEY"] or s3["MINIO_ROOT_PASSWORD"] != s3["S3_SECRET_KEY"] or len(s3["S3_SECRET_KEY"]) < 32:
        raise ValueError("Demo MinIO credentials are inconsistent or too short.")


def _validate_demo_material(decoded):
    if decoded["esign-secrets"][CERTIFICATE_FILENAME] == (ROOT / "services/platform/esign-service/server/certs/certificate.p12").read_bytes():
        raise ValueError("The tracked local PDF certificate cannot be used for the demo.")
    local_public_key = ROOT / ".auth-keys" / PUBLIC_KEY_FILENAME
    if local_public_key.exists() and decoded["auth-public-key"][PUBLIC_KEY_FILENAME] == local_public_key.read_bytes():
        raise ValueError("The local JWT signing key cannot be used for the demo.")
    if len(decoded["esign-secrets"]["SIGNING_CERT_PASSWORD"]) < 32:
        raise ValueError("Demo signing certificate password is too short.")
    with tempfile.TemporaryDirectory(prefix="dsap-validate-") as tmp:
        private, cert = Path(tmp) / "key.pem", Path(tmp) / "cert.p12"
        private.write_bytes(decoded["auth-signing-key"][PRIVATE_KEY_FILENAME])
        cert.write_bytes(decoded["esign-secrets"][CERTIFICATE_FILENAME])
        if run("openssl", "pkey", "-in", str(private), "-pubout") != decoded["auth-public-key"][PUBLIC_KEY_FILENAME]:
            raise ValueError("Demo JWT signing key pair does not match.")
        run("openssl", "pkcs12", "-in", str(cert), "-noout", "-passin", "stdin",
            input=decoded["esign-secrets"]["SIGNING_CERT_PASSWORD"] + b"\n")


def validate(bundle):
    decoded = _decode_bundle(bundle)
    _validate_required_keys(decoded)
    _validate_nats_credentials(decoded)
    _validate_database_credentials(decoded)
    _validate_minio_credentials(decoded)
    _validate_demo_material(decoded)
    return decoded


def _parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--context", required=True, help="explicit Kubernetes context")
    parser.add_argument("--namespace", required=True, help="existing demo namespace (not platform-local)")
    parser.add_argument("--dir", required=True, type=Path, help="private directory for persistent generated material")
    parser.add_argument("--init", action="store_true", help="explicitly initialize new demo material if absent")
    return parser.parse_args()


def _prepare_directory(args):
    directory = args.dir.expanduser().resolve()
    if directory.is_relative_to(ROOT) and not directory.is_relative_to(ROOT / ".auth-keys"):
        raise ValueError("Store demo material outside the repository or under the ignored .auth-keys directory.")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if directory.stat().st_mode & 0o077:
        raise ValueError("Demo material directory must not be accessible to group or other users.")
    return directory


def _acquire_lock(directory):
    lock = directory / ".provision.lock"
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError as error:
        raise ValueError(f"Provisioning lock exists at {lock}; inspect it before removing a stale lock.") from error
    return lock


def _check_initialization_allowed(args, existing):
    if not args.init:
        raise ValueError("No demo material exists. Use --init only for a new deployment.")
    if any(existing.values()):
        raise ValueError("Demo Secrets already exist; recover the original material rather than generating replacements.")
    workloads = ("topology-db", "compliance-db", "audit-db", "minio", "nats",
                 "auth-server", "esign-server", "topology-server", "compliance-server", "audit-server")
    for name in workloads:
        if get(args.context, args.namespace, "pvc", name) or get(args.context, args.namespace, "deployment", name):
            raise ValueError(f"{name} storage or deployment exists; recover its credentials before initializing.")


def _save_bundle(path, directory, args):
    bundle = generate(directory)
    validate(bundle)
    saved = {"version": 1, "context": args.context, "namespace": args.namespace, "secrets": bundle}
    fd, tmp = tempfile.mkstemp(prefix=".bundle-", dir=directory)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w") as file:
            json.dump(saved, file)
            file.flush()
            os.fsync(file.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _initialize_material(path, directory, args, existing):
    if path.is_symlink():
        raise ValueError("Refusing a symlink for demo secret material.")
    if not path.exists():
        _check_initialization_allowed(args, existing)
        _save_bundle(path, directory, args)


def _load_material(path, args):
    if path.stat().st_mode & 0o077:
        raise ValueError("Demo material file must not be accessible to group or other users.")
    saved = json.loads(path.read_text())
    if saved.get("version") != 1 or saved.get("context") != args.context or saved.get("namespace") != args.namespace:
        raise ValueError("Demo material is bound to a different context or namespace.")
    return validate(saved["secrets"])


def _check_missing_secret(args, name):
    workload = {"topology-db-credentials": "topology-db", "compliance-db-credentials": "compliance-db",
                "audit-db-credentials": "audit-db", "minio-credentials": "minio",
                "nats-broker-credentials": "nats", "auth-signing-key": "auth-server",
                "esign-secrets": "esign-server"}.get(name)
    if workload and (get(args.context, args.namespace, "pvc", workload) or
                     get(args.context, args.namespace, "deployment", workload)):
        raise ValueError(f"Secret {name} is missing but {workload} exists; recover it before retrying.")
    if name == "auth-public-key":
        for workload in ("topology-server", "compliance-server", "audit-server"):
            if get(args.context, args.namespace, "deployment", workload):
                raise ValueError(f"Secret {name} is missing but {workload} exists; recover it before retrying.")


def _check_existing_secrets(args, existing, decoded):
    for name, resource in existing.items():
        if resource:
            current = {key: base64.b64decode(value, validate=True) for key, value in resource.get("data", {}).items()}
            local.compare(name, current, decoded[name])
        else:
            _check_missing_secret(args, name)


def _create_missing_secrets(args, existing, decoded):
    for name, resource in existing.items():
        if not resource:
            body = {"apiVersion": "v1", "kind": "Secret", "metadata": {"name": name, "namespace": args.namespace},
                    "type": "Opaque",
                    "data": {key: base64.b64encode(value).decode() for key, value in decoded[name].items()}}
            kubectl(args.context, args.namespace, "create", "-f", "-", input=json.dumps(body).encode())
            print(f"Created Secret {name}/{args.namespace}.")


def main():
    args = _parse_args()
    if args.namespace == "platform-local":
        raise ValueError("The demo must use a namespace distinct from platform-local.")
    kubectl(args.context, args.namespace, "get", "namespace", args.namespace)
    existing = {name: get(args.context, args.namespace, "secret", name) for name in NAMES}
    directory = _prepare_directory(args)
    lock = _acquire_lock(directory)
    try:
        path = directory / "demo-secrets.json"
        _initialize_material(path, directory, args, existing)
        decoded = _load_material(path, args)
        _check_existing_secrets(args, existing, decoded)
        _create_missing_secrets(args, existing, decoded)
        print(f"Demo Secrets are available in {args.context}/{args.namespace}; retain and protect {path}.")
    finally:
        lock.rmdir()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Demo secret provisioning failed: {error}", file=sys.stderr)
        sys.exit(1)
