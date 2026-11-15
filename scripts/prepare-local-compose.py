#!/usr/bin/env python3
"""Prepare local Compose credentials from the service-owned env files."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("local_secrets", ROOT / "scripts/k8s-local-secrets.py")
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)


def main():
    paths, required = configuration()
    values = {name: local.env_file(ROOT / path) for name, path in paths.items()}
    validate_credentials(values, paths, required)
    services = build_services(values)
    validate_service_values(services)
    prepare_credentials(services, values, required)
    print("Local development credentials prepared.")


def configuration():
    paths = {
        "topology": "services/core/topology-service/.env",
        "compliance": "services/core/compliance-service/.env",
        "audit": "services/core/audit-ledger/.env",
        "esign": "services/platform/esign-service/.env",
        "pdf": "services/platform/pdf-generator/.env",
    }
    required = {"topology": ("DB_USER", "DB_PASSWORD"),
                          "compliance": ("DB_USER", "DB_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY"),
                          "audit": ("DB_USER", "DB_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY"),
                          "esign": ("S3_ACCESS_KEY", "S3_SECRET_KEY", "SIGNING_CERT_PASSWORD"),
                          "pdf": ("S3_ACCESS_KEY", "S3_SECRET_KEY")}
    return paths, required


def validate_credentials(values, paths, required):
    for service, keys in required.items():
        missing = [key for key in keys if not values[service].get(key)]
        if missing:
            raise ValueError(f"{paths[service]} is missing: {', '.join(missing)}; run pnpm env:copy.")
    for name in ("compliance", "audit", "pdf"):
        if any(values[name][key] != values["esign"][key] for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY")):
            raise ValueError(f"Local S3 credentials in {paths[name]} differ from {paths['esign']}; reconcile them before starting Compose.")
    if "/" in values["topology"]["DB_USER"] or "/" in values["topology"]["DB_PASSWORD"]:
        raise ValueError("Neo4j username/password cannot contain '/'.")
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
        "MINIO_ROOT_USER": values["esign"]["S3_ACCESS_KEY"],
        "MINIO_ROOT_PASSWORD": values["esign"]["S3_SECRET_KEY"],
    }
    services = {
        "topology-db": {
            "NEO4J_AUTH": f"{values['topology']['DB_USER']}/{values['topology']['DB_PASSWORD']}",
            "DB_USER": values["topology"]["DB_USER"], "DB_PASSWORD": values["topology"]["DB_PASSWORD"]},
        "compliance-db": {"POSTGRES_USER": values["compliance"]["DB_USER"],
                          "POSTGRES_PASSWORD": values["compliance"]["DB_PASSWORD"]},
        "audit-db": {"MONGO_INITDB_ROOT_USERNAME": values["audit"]["DB_USER"],
                     "MONGO_INITDB_ROOT_PASSWORD": values["audit"]["DB_PASSWORD"]},
    }
    for name in ("topology", "compliance", "audit"):
        services[f"{name}-server"] = {key: values[name][key] for key in ("DB_USER", "DB_PASSWORD")}
    for name in ("compliance", "audit", "esign", "pdf"):
        services.setdefault(f"{name}-server", {}).update({key: values[name][key] for key in ("S3_ACCESS_KEY", "S3_SECRET_KEY")})
    services["esign-server"]["SIGNING_CERT_PASSWORD"] = values["esign"]["SIGNING_CERT_PASSWORD"]
    services["dbgate"] = dbgate
    services["minio"] = minio
    return services


def validate_service_values(services):
    if any("\n" in value or "\r" in value for data in services.values() for value in data.values()):
        raise ValueError("Local Compose credentials must not contain newlines.")


def prepare_credentials(services, values, required):
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
        update_generation(auth, generations, services, values, required)
    finally:
        lock.rmdir()


def update_generation(auth, generations, services, values, required):
    pointer = auth / "local"
    if pointer.exists() and not pointer.is_symlink():
        raise ValueError(".auth-keys/local is not a generated symlink; inspect and move it before retrying.")
    if pointer.is_symlink() and pointer.resolve().parent != generations.resolve():
        raise ValueError(".auth-keys/local points outside the local credential generations directory.")
    expected = expected_files(services, values, required)
    if credentials_unchanged(pointer, expected):
        print("Local development credentials are unchanged.")
        return
    directory = Path(tempfile.mkdtemp(prefix="generation-", dir=generations))
    for name, contents in expected.items():
        write_atomic(directory, name, contents)
    link = directory / "current-link"
    link.symlink_to(Path("local-generations") / directory.name)
    os.replace(link, pointer)


def expected_files(services, values, required):
    expected = {}
    for name, result in services.items():
        expected[f"{name}.env"] = "".join(
            f"{key}='{value.replace(chr(39), chr(92) + chr(39))}'\n" for key, value in result.items())
    shared = {name: {key: values[name][key] for key in keys} for name, keys in required.items()}
    expected["credentials.json"] = json.dumps(shared)
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
        main()
    except (OSError, ValueError) as error:
        print(f"Local Compose setup failed: {error}", file=sys.stderr)
        sys.exit(1)
