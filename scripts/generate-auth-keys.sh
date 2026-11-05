#!/usr/bin/env bash
# File: scripts/generate-auth-keys.sh
# Generates the RS256 key pair used by auth-service (private) and every verifying server (public).
# Existing keys are kept unless --force is passed.
set -euo pipefail

dir=".auth-keys"
force="${1:-}"

if [[ -f "${dir}/private.pem" && "${force}" != "--force" ]]; then
  echo "Auth keys already exist in ${dir}/ (use --force to rotate)."
  exit 0
fi

mkdir -p "${dir}"
umask 077
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${dir}/private.pem"
openssl pkey -in "${dir}/private.pem" -pubout -out "${dir}/public.pem"
# Containers run as an unprivileged user and need to read the mounted secrets.
chmod 644 "${dir}/private.pem" "${dir}/public.pem"
echo "Generated auth key pair in ${dir}/."
