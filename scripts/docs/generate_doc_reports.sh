#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT_DIR"

for command in python3 node git; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required to generate source-based reports." >&2
    exit 127
  fi
done

python3 scripts/docs/generate_dependency_reports.py
