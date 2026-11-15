#!/usr/bin/env bash
# File: scripts/generate-auth-keys.sh
# Generates the RS256 key pair used by auth-service (private) and every verifying server (public).
# Existing keys are kept unless --force is passed.
set -euo pipefail

dir=".auth-keys"
force="${1:-}"

if [[ -f "${dir}/private.pem" && -f "${dir}/public.pem" && "${force}" != "--force" ]]; then
  chmod 700 "${dir}"
  if ! openssl pkey -in "${dir}/private.pem" -pubout 2>/dev/null | cmp -s - "${dir}/public.pem"; then
    echo "Auth public and private keys do not match; recover the original pair." >&2
    exit 1
  fi
  echo "Auth keys already exist in ${dir}/ (use --force to rotate)."
  exit 0
fi

if [[ "${force}" != "--force" && ( -e "${dir}/private.pem" || -e "${dir}/public.pem" ) ]]; then
  echo "Auth key pair is incomplete; recover the missing key before retrying." >&2
  exit 1
fi

mkdir -p "${dir}"
umask 077
chmod 700 "${dir}"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${dir}/private.pem"
openssl pkey -in "${dir}/private.pem" -pubout -out "${dir}/public.pem"
# Containers run as an unprivileged user and need to read the mounted secrets.
chmod 644 "${dir}/private.pem" "${dir}/public.pem"
echo "Generated auth key pair in ${dir}/."
