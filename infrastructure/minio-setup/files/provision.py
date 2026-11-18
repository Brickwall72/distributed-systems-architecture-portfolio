#!/usr/bin/env python3
# File: infrastructure/minio-setup/files/provision.py
"""Provision and verify the private DSAP bucket and scoped MinIO accounts."""

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import ProxyHandler, Request, build_opener


POLICIES = {
    "compliance": "dsap-compliance-v1",
    "audit": "dsap-audit-v1",
    "worker": "dsap-worker-v1",
}
USERS = {
    "compliance": ("compliance", "compliance/drafts/"),
    "audit": ("audit", "audit/transfers/"),
    "pdf": ("worker", "compliance/drafts/"),
    "esign": ("worker", "compliance/transfers/"),
}
FILES = Path(__file__).resolve().parent / "policies"
LOCK_PATH = "/dsap/.dsap-provision-lock"
READY_MARKER = b"dsap scoped identity ready v1\n"
HTTP = build_opener(ProxyHandler({}))


def canonical(value):
    if isinstance(value, dict):
        return {key: canonical(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return sorted((canonical(item) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    return value


def read_settings():
    endpoint = os.environ.get("MINIO_ENDPOINT", "")
    parsed = urlsplit(endpoint)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise ValueError("MINIO_ENDPOINT must be an HTTP(S) origin without credentials or a path.")
    if os.environ.get("MINIO_BUCKET", "dsap") != "dsap":
        raise ValueError("The scoped policies require the dsap bucket.")
    root = (os.environ.get("MINIO_ROOT_USER", ""), os.environ.get("MINIO_ROOT_PASSWORD", ""))
    accounts = {
        name: (os.environ.get(f"{name.upper()}_ACCESS_KEY", ""), os.environ.get(f"{name.upper()}_SECRET_KEY", ""))
        for name in USERS
    }
    all_accounts = [root, *accounts.values()]
    if any(not re.fullmatch(r"[A-Za-z0-9_.-]{3,128}", user) or len(password) < 8
           or "\n" in password or "\r" in password for user, password in all_accounts):
        raise ValueError("Each MinIO identity requires a valid access key and a secret of at least eight characters without newlines.")
    if len({user for user, _ in all_accounts}) != len(all_accounts) or len({password for _, password in all_accounts}) != len(all_accounts):
        raise ValueError("MinIO root and service identities must have distinct access keys and secrets.")
    return endpoint.rstrip("/"), root, accounts


def alias(endpoint, account):
    parsed = urlsplit(endpoint)
    user, password = account
    return f"{parsed.scheme}://{quote(user, safe='')}:{quote(password, safe='')}@{parsed.netloc}"


def mc(env, *args, input=None, allow_failure=False):
    with tempfile.TemporaryDirectory(prefix="dsap-mc-") as config_dir:
        result = subprocess.run(
            ["mc", "--json", "--config-dir", config_dir, *args],
            env=env, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )
    records = []
    for line in result.stdout.splitlines():
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise RuntimeError(f"MinIO command {args[0]} returned invalid JSON.") from error
    if result.returncode and not allow_failure:
        raise RuntimeError(f"MinIO command {' '.join(args[:2])} failed (exit {result.returncode}).")
    return result.returncode, records


def wait_for_minio(endpoint):
    for _ in range(60):
        try:
            with HTTP.open(f"{endpoint}/minio/health/ready", timeout=3) as response:
                if response.status == 200:
                    return
        except (URLError, TimeoutError):
            pass
        time.sleep(1)
    raise RuntimeError("MinIO did not become ready.")


def verify_credentials(env, endpoint, account, prefix):
    verify_env = {**env, "MC_HOST_verify": alias(endpoint, account)}
    status, records = mc(verify_env, "ls", f"verify/dsap/{prefix}", allow_failure=True)
    if not status:
        return
    codes = [record.get("error", {}).get("cause", {}).get("error", {}).get("Code") for record in records]
    if codes and all(code in ("AccessDenied", "NoSuchBucket") for code in codes):
        return
    raise ValueError(f"MinIO credentials for {account[0]} do not authenticate; no password was rotated.")


def lock_request(endpoint, root, method, data=b"", conditional=False, path=LOCK_PATH):
    now = datetime.now(timezone.utc)
    date, timestamp = now.strftime("%Y%m%d"), now.strftime("%Y%m%dT%H%M%SZ")
    digest = hashlib.sha256(data).hexdigest()
    headers = {
        "host": urlsplit(endpoint).netloc,
        "x-amz-content-sha256": digest,
        "x-amz-date": timestamp,
    }
    if conditional:
        headers["if-none-match"] = "*"
    signed_headers = ";".join(sorted(headers))
    canonical_headers = "".join(f"{key}:{headers[key]}\n" for key in sorted(headers))
    request = f"{method}\n{path}\n\n{canonical_headers}\n{signed_headers}\n{digest}"
    scope = f"{date}/us-east-1/s3/aws4_request"
    to_sign = f"AWS4-HMAC-SHA256\n{timestamp}\n{scope}\n{hashlib.sha256(request.encode()).hexdigest()}"
    key = ("AWS4" + root[1]).encode()
    for part in (date, "us-east-1", "s3", "aws4_request"):
        key = hmac.new(key, part.encode(), hashlib.sha256).digest()
    signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
    headers["Authorization"] = f"AWS4-HMAC-SHA256 Credential={root[0]}/{scope}, SignedHeaders={signed_headers}, Signature={signature}"
    return HTTP.open(Request(endpoint + path, data=data if method == "PUT" else None, headers=headers, method=method), timeout=10)


@contextmanager
def provisioning_lock(endpoint, root):
    token = secrets.token_hex(32).encode()
    try:
        with lock_request(endpoint, root, "PUT", token, conditional=True) as response:
            response.read()
    except HTTPError as error:
        if error.code in (409, 412):
            raise RuntimeError("MinIO provisioning lock exists; verify no provisioner is running before explicitly recovering it.") from error
        raise RuntimeError(f"Could not acquire the MinIO provisioning lock (HTTP {error.code}).") from error
    try:
        yield
    finally:
        try:
            with lock_request(endpoint, root, "GET") as response:
                if response.read() != token:
                    raise RuntimeError("MinIO provisioning lock changed; refusing to remove it.")
            with lock_request(endpoint, root, "DELETE") as response:
                response.read()
        except HTTPError as error:
            raise RuntimeError(f"Could not release the MinIO provisioning lock (HTTP {error.code}); inspect it before retrying.") from error


def inspect_state(env, endpoint, accounts):
    _, existing_users = mc(env, "admin", "user", "list", "admin")
    _, existing_policies = mc(env, "admin", "policy", "list", "admin")
    _, buckets = mc(env, "ls", "admin")
    user_map = {entry["accessKey"]: entry for entry in existing_users}
    policy_names = {entry["policy"] for entry in existing_policies}
    bucket_exists = any(entry.get("key") == "dsap/" for entry in buckets)
    expected = {name: json.loads((FILES / f"{name}.json").read_text()) for name in POLICIES}

    for name, policy_name in POLICIES.items():
        if policy_name in policy_names:
            _, info = mc(env, "admin", "policy", "info", "admin", policy_name)
            if len(info) != 1 or canonical(info[0]["policyInfo"]["Policy"]) != canonical(expected[name]):
                raise ValueError(f"Existing MinIO policy {policy_name} conflicts with the expected policy.")

    for name, (policy, prefix) in USERS.items():
        user, _ = accounts[name]
        if user not in user_map:
            continue
        _, info = mc(env, "admin", "user", "info", "admin", user)
        if len(info) != 1:
            raise ValueError(f"Could not inspect MinIO user {user}.")
        entry = info[0]
        attached = {item for item in entry.get("policyName", "").split(",") if item}
        if entry.get("userStatus") != "enabled" or entry.get("memberOf") or attached not in (set(), {POLICIES[policy]}):
            raise ValueError(f"Existing MinIO user {user} has conflicting policies, groups, or status.")
        verify_credentials(env, endpoint, accounts[name], prefix)
    return user_map, policy_names, bucket_exists


def provision_policies(env, policy_names):
    for name, policy_name in POLICIES.items():
        if policy_name not in policy_names:
            mc(env, "admin", "policy", "create", "admin", policy_name, str(FILES / f"{name}.json"))


def provision_users(env, endpoint, accounts, user_map):
    for name, (policy, prefix) in USERS.items():
        user, password = accounts[name]
        if user not in user_map:
            mc(env, "admin", "user", "add", "admin", input=f"{user}\n{password}\n".encode())
            verify_credentials(env, endpoint, accounts[name], prefix)
        if user not in user_map or not user_map[user].get("policyName"):
            mc(env, "admin", "policy", "attach", "admin", POLICIES[policy], "--user", user)


def provision_ready_markers(endpoint, root):
    for prefix in {prefix for _, prefix in USERS.values()}:
        path = f"/dsap/{prefix}.dsap-ready"
        try:
            with lock_request(endpoint, root, "PUT", READY_MARKER, conditional=True, path=path) as response:
                response.read()
        except HTTPError as error:
            if error.code != 412:
                raise
            with lock_request(endpoint, root, "GET", path=path) as response:
                if response.read() != READY_MARKER:
                    raise ValueError(f"Existing MinIO readiness marker {path} conflicts; inspect it before provisioning.")


def provision():
    endpoint, root, accounts = read_settings()
    wait_for_minio(endpoint)
    env = {key: value for key, value in os.environ.items()
           if key.upper() not in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY")}
    env["MC_HOST_admin"] = alias(endpoint, root)
    _, _, bucket_exists = inspect_state(env, endpoint, accounts)

    if not bucket_exists:
        mc(env, "mb", "--ignore-existing", "admin/dsap")
    with provisioning_lock(endpoint, root):
        user_map, policy_names, _ = inspect_state(env, endpoint, accounts)
        mc(env, "anonymous", "set", "none", "admin/dsap")
        provision_policies(env, policy_names)
        provision_users(env, endpoint, accounts, user_map)
        provision_ready_markers(endpoint, root)
    print("Private MinIO bucket, scoped policies, and service identities verified.")


def check_ready():
    endpoint = os.environ.get("MINIO_ENDPOINT", "")
    parsed = urlsplit(endpoint)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise ValueError("MINIO_ENDPOINT must be an HTTP(S) origin without credentials or a path.")
    prefix = os.environ.get("MINIO_READY_PREFIX", "")
    if prefix not in {prefix for _, prefix in USERS.values()}:
        raise ValueError("MINIO_READY_PREFIX must name a provisioned domain prefix.")
    account = (os.environ.get("S3_ACCESS_KEY", ""), os.environ.get("S3_SECRET_KEY", ""))
    if not all(account):
        raise ValueError("S3_ACCESS_KEY and S3_SECRET_KEY are required.")
    with lock_request(endpoint.rstrip("/"), account, "GET", path=f"/dsap/{prefix}.dsap-ready") as response:
        if response.read() != READY_MARKER:
            raise ValueError("MinIO readiness marker does not match the expected value.")


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--check-ready"]:
            check_ready()
        elif not sys.argv[1:]:
            provision()
        else:
            raise ValueError("Unsupported MinIO setup argument.")
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f"MinIO provisioning failed: {error}", file=sys.stderr)
        sys.exit(1)
