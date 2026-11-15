#!/usr/bin/env python3
"""Prepare local Compose credentials from the service-owned env files."""

import importlib.util
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
CREDENTIALS_FILENAME = "credentials.json"
spec = importlib.util.spec_from_file_location("local_secrets", ROOT / "scripts/k8s-local-secrets.py")
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)


def main(accept_existing_state=False):
    paths, required = configuration()
    values = {name: local.env_file(ROOT / path) for name, path in paths.items()}
    validate_credentials(values, paths, required)
    services = build_services(values)
    validate_service_values(services)
    prepare_credentials(services, values, required, accept_existing_state)
    print("Local development credentials prepared.")


def configuration():
    paths = {
        "platform": ".env",
        "topology": "services/core/topology-service/.env",
        "compliance": "services/core/compliance-service/.env",
        "audit": "services/core/audit-ledger/.env",
        "esign": "services/platform/esign-service/.env",
        "pdf": "services/platform/pdf-generator/.env",
    }
    required = {"platform": ("MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD"),
                          "topology": ("DB_USER", "DB_PASSWORD"),
                          "compliance": ("DB_USER", "DB_PASSWORD", "DB_ADMIN_USER", "DB_ADMIN_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY"),
                          "audit": ("DB_USER", "DB_PASSWORD", "DB_ADMIN_USER", "DB_ADMIN_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY"),
                          "esign": ("S3_ACCESS_KEY", "S3_SECRET_KEY", "SIGNING_CERT_PASSWORD"),
                          "pdf": ("S3_ACCESS_KEY", "S3_SECRET_KEY")}
    return paths, required


def validate_credentials(values, paths, required):
    _validate_required_credentials(values, paths, required)
    fields = _credential_fields()
    _validate_distinct_identities(values, paths, fields)
    _validate_identity_formats(values, fields)
    _validate_database_credentials(values)
    _validate_signing_certificate(values)


def _validate_required_credentials(values, paths, required):
    for service, keys in required.items():
        missing = [key for key in keys if not values[service].get(key)]
        if missing:
            raise ValueError(
                f"{paths[service]} has missing or empty values: {', '.join(missing)}. "
                "Run pnpm env:copy to add missing entries; edit any empty values manually."
            )


def _credential_fields():
    fields = [("platform", "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD")]
    fields.extend((name, "S3_ACCESS_KEY", "S3_SECRET_KEY")
                  for name in ("compliance", "audit", "esign", "pdf"))
    return fields


def _validate_distinct_identities(values, paths, fields):
    conflicts = []
    for index, label in ((1, "access keys"), (2, "secrets")):
        groups = {}
        for field in fields:
            name, key = field[0], field[index]
            groups.setdefault(values[name][key], []).append(f"{paths[name]}:{key}")
        conflicts.extend(f"{label}: {', '.join(group)}" for group in groups.values() if len(group) > 1)
    if conflicts:
        raise ValueError(
            "Local MinIO root and service identities must have distinct access keys and secrets. "
            "Conflicting entries (values not shown): " + "; ".join(conflicts) + ". "
            "Review the local credential recovery guidance in README.md before changing existing credentials."
        )


def _validate_identity_formats(values, fields):
    identities = [(values[name][user], values[name][password]) for name, user, password in fields]
    if any(not re.fullmatch(r"[A-Za-z0-9_.-]{3,128}", user) or len(password) < 8
           for user, password in identities):
        raise ValueError("Local MinIO identities require valid access keys and secrets of at least eight characters.")


def _validate_database_credentials(values):
    for name in ("compliance", "audit"):
        if (values[name]["DB_USER"] == values[name]["DB_ADMIN_USER"]
                or values[name]["DB_PASSWORD"] == values[name]["DB_ADMIN_PASSWORD"]):
            raise ValueError(f"Local {name} database administrator and runtime credentials must differ.")
    if "/" in values["topology"]["DB_USER"] or "/" in values["topology"]["DB_PASSWORD"]:
        raise ValueError("Neo4j username/password cannot contain '/'.")


def _validate_signing_certificate(values):
    cert = ROOT / "services/platform/esign-service/server/certs/certificate.p12"
    if not cert.is_file():
        raise ValueError("Local PDF signing certificate is missing; restore it before retrying.")
    result = subprocess.run(["openssl", "pkcs12", "-in", str(cert), "-noout", "-passin", "stdin"],
                            input=(values["esign"]["SIGNING_CERT_PASSWORD"] + "\n").encode(),
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode:
        raise ValueError("The PDF signing certificate cannot be opened with SIGNING_CERT_PASSWORD.")


def build_services(values):
    dbgate = {
        "USER_compliance": values["compliance"]["DB_USER"],
        "PASSWORD_compliance": values["compliance"]["DB_PASSWORD"],
        "USER_audit": values["audit"]["DB_USER"],
        "PASSWORD_audit": values["audit"]["DB_PASSWORD"],
    }
    minio = {
        "MINIO_ROOT_USER": values["platform"]["MINIO_ROOT_USER"],
        "MINIO_ROOT_PASSWORD": values["platform"]["MINIO_ROOT_PASSWORD"],
    }
    services = {
        "topology-db": {
            "NEO4J_AUTH": f"{values['topology']['DB_USER']}/{values['topology']['DB_PASSWORD']}",
            "DB_USER": values["topology"]["DB_USER"], "DB_PASSWORD": values["topology"]["DB_PASSWORD"]},
        "compliance-db": {"POSTGRES_USER": values["compliance"]["DB_ADMIN_USER"],
                          "POSTGRES_PASSWORD": values["compliance"]["DB_ADMIN_PASSWORD"]},
        "audit-db": {"MONGO_INITDB_ROOT_USERNAME": values["audit"]["DB_ADMIN_USER"],
                     "MONGO_INITDB_ROOT_PASSWORD": values["audit"]["DB_ADMIN_PASSWORD"]},
    }
    services["compliance-db-setup"] = {
        "PGUSER": values["compliance"]["DB_ADMIN_USER"], "PGPASSWORD": values["compliance"]["DB_ADMIN_PASSWORD"],
        "COMPLIANCE_RUNTIME_USER": values["compliance"]["DB_USER"],
        "COMPLIANCE_RUNTIME_PASSWORD": values["compliance"]["DB_PASSWORD"],
    }
    services["audit-db-setup"] = {
        "MONGO_ADMIN_USER": values["audit"]["DB_ADMIN_USER"], "MONGO_ADMIN_PASSWORD": values["audit"]["DB_ADMIN_PASSWORD"],
        "AUDIT_RUNTIME_USER": values["audit"]["DB_USER"], "AUDIT_RUNTIME_PASSWORD": values["audit"]["DB_PASSWORD"],
    }
    for name in ("topology", "compliance", "audit"):
        services[f"{name}-server"] = {key: values[name][key] for key in ("DB_USER", "DB_PASSWORD")}
    for name in ("compliance", "audit", "esign", "pdf"):
        services.setdefault(f"{name}-server", {}).update({key: values[name][key] for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY")})
    services["esign-server"]["SIGNING_CERT_PASSWORD"] = values["esign"]["SIGNING_CERT_PASSWORD"]
    services["dbgate"] = dbgate
    services["minio"] = minio
    services["minio-setup"] = {
        **minio,
        **{f"{name.upper()}_{key.removeprefix('S3_')}": values[name][key]
           for name in ("compliance", "audit", "esign", "pdf") for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY")},
    }
    return services


def validate_service_values(services):
    if any("\n" in value or "\r" in value for data in services.values() for value in data.values()):
        raise ValueError("Local Compose credentials must not contain newlines.")


def prepare_credentials(services, values, required, accept_existing_state=False):
    auth = ROOT / ".auth-keys"
    if auth.is_symlink():
        raise ValueError(".auth-keys must not be a symlink.")
    auth.mkdir(mode=0o700, exist_ok=True)
    os.chmod(auth, 0o700)
    generations = auth / "local-generations"
    if generations.is_symlink():
        raise ValueError(".auth-keys/local-generations must not be a symlink.")
    generations.mkdir(mode=0o700, exist_ok=True)
    os.chmod(generations, 0o700)
    lock = auth / ".local-credentials.lock"
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError as error:
        raise ValueError(f"Credential preparation lock exists at {lock}; inspect it before removing a stale lock.") from error
    try:
        update_generation(auth, generations, services, values, required, accept_existing_state)
    finally:
        lock.rmdir()


def update_generation(auth, generations, services, values, required, accept_existing_state=False):
    pointer = auth / "local"
    if pointer.exists() and not pointer.is_symlink():
        raise ValueError(".auth-keys/local is not a generated symlink; inspect and move it before retrying.")
    if pointer.is_symlink() and pointer.resolve().parent != generations.resolve():
        raise ValueError(".auth-keys/local points outside the local credential generations directory.")
    expected = expected_files(services, values, required)
    if credentials_unchanged(pointer, expected):
        print("Local development credentials are unchanged.")
        return
    guard_existing_state(pointer, expected[CREDENTIALS_FILENAME], accept_existing_state)
    directory = Path(tempfile.mkdtemp(prefix="generation-", dir=generations))
    for name, contents in expected.items():
        write_atomic(directory, name, contents)
    link = directory / "current-link"
    link.symlink_to(Path("local-generations") / directory.name)
    os.replace(link, pointer)


def guard_existing_state(pointer, expected_credentials, accept_existing_state=False):
    previous = pointer / CREDENTIALS_FILENAME
    if previous.is_file() and previous.read_text() == expected_credentials:
        return
    for project in ("distributed-systems-architecture-portfolio", "dsap-local"):
        if compose_state_exists(project) and not accept_existing_state:
            raise ValueError(f"Compose project {project} has existing state while credentials are changing; recover its original credentials or preview an explicit local reset before retrying.")
        if accept_existing_state and compose_project_is_running(project):
            raise ValueError(f"Compose project {project} still has running containers; stop it before accepting manually provisioned credentials.")


def compose_state_exists(project):
    for args in (("volume", "ls", "-q"), ("ps", "-aq")):
        try:
            result = subprocess.run(
                ("docker", *args, "--filter", f"label=com.docker.compose.project={project}"),
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
            )
        except (OSError, subprocess.CalledProcessError) as error:
            raise ValueError("Cannot verify existing Compose state before changing credentials; start Docker and retry.") from error
        if result.stdout.strip():
            return True
    return False


def compose_project_is_running(project):
    try:
        running = subprocess.run(
            ("docker", "ps", "-q", "--filter", f"label=com.docker.compose.project={project}"),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise ValueError("Cannot verify running Compose workloads before accepting changed credentials.") from error
    return bool(running.stdout.strip())


def expected_files(services, values, required):
    expected = {}
    for name, result in services.items():
        expected[f"{name}.env"] = "".join(
            f"{key}='{value.replace(chr(39), chr(92) + chr(39))}'\n" for key, value in result.items())
    shared = {name: {key: values[name][key] for key in keys} for name, keys in required.items()}
    expected[CREDENTIALS_FILENAME] = json.dumps(shared)
    return expected


def credentials_unchanged(pointer, expected):
    return pointer.is_dir() and all(
        (pointer / name).is_file()
        and (pointer / name).read_text() == content
        and not (pointer / name).stat().st_mode & 0o077
        for name, content in expected.items()
    )


def write_atomic(directory, filename, contents):
    fd, temporary = tempfile.mkstemp(prefix=".compose-", dir=directory)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w") as file:
            file.write(contents)
        os.replace(temporary, directory / filename)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--accept-provisioned-credentials", action="store_true",
                            help="accept manually provisioned credentials with existing stopped Compose state")
        args = parser.parse_args()
        if args.accept_provisioned_credentials:
            print("This does not rotate any database or MinIO account. Confirm that every changed credential was already provisioned and all Compose workloads are stopped.")
            try:
                confirmation = input("Type 'accept provisioned credentials' to continue: ")
            except EOFError as error:
                raise ValueError("Interactive credential change confirmation is required.") from error
            if confirmation != "accept provisioned credentials":
                raise ValueError("Credential change confirmation was not provided.")
        main(accept_existing_state=args.accept_provisioned_credentials)
    except (OSError, ValueError) as error:
        print(f"Local Compose setup failed: {error}", file=sys.stderr)
        sys.exit(1)
