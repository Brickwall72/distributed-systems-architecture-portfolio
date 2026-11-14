#!/usr/bin/env bash
# File: scripts/generate-nats-credentials.sh
set -euo pipefail
umask 077

dir=.auth-keys/nats
mkdir -p "$dir"
if ! mkdir "$dir/.lock" 2>/dev/null; then
  echo "Cannot acquire NATS credential lock; another setup may be running." >&2
  exit 1
fi
trap 'rmdir "$dir/.lock"' EXIT

for user in compliance topology audit esign pdf; do
  password_file="$dir/$user.password"
  if [[ ! -e "$password_file" ]]; then
    openssl rand -hex 32 > "$password_file"
  fi
  password=$(<"$password_file")
  if [[ ! "$password" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Invalid NATS credential in $password_file; the existing value was not changed." >&2
    exit 1
  fi
  printf 'NATS_USER=%s\nNATS_PASSWORD=%s\n' "$user" "$password" > "$dir/$user.env.tmp"
  mv "$dir/$user.env.tmp" "$dir/$user.env"
done

: > "$dir/broker.env.tmp"
for user in compliance topology audit esign pdf; do
  password=$(<"$dir/$user.password")
  printf 'NATS_%s_PASSWORD=%s\n' "${user^^}" "$password" >> "$dir/broker.env.tmp"
done
mv "$dir/broker.env.tmp" "$dir/broker.env"
echo "Local NATS service credentials are available in $dir."
