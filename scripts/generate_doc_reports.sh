#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SUNSHINE_CLI=${SUNSHINE_CLI:-"$ROOT_DIR/.tools/cyclonedx-sunshine/sunshine.py"}
case "$SUNSHINE_CLI" in
  /*) ;;
  *) SUNSHINE_CLI="$ROOT_DIR/$SUNSHINE_CLI" ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required to build the application images." >&2
  exit 127
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is unavailable." >&2
  exit 1
fi
if ! command -v skaffold >/dev/null 2>&1; then
  echo "Skaffold is required to build and discover application images." >&2
  exit 127
fi
if ! command -v docker >/dev/null 2>&1 || ! docker buildx version >/dev/null 2>&1; then
  echo "Docker Buildx is required to build the shared base image." >&2
  exit 1
fi
if ! command -v trivy >/dev/null 2>&1; then
  echo "Trivy is required to generate CycloneDX SBOMs." >&2
  exit 127
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to generate the reports." >&2
  exit 127
fi
if [ ! -f "$SUNSHINE_CLI" ]; then
  echo "CycloneDX Sunshine was not found at $SUNSHINE_CLI. Set SUNSHINE_CLI to sunshine.py." >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM

cd "$ROOT_DIR"
docker buildx build --load -f Dockerfile.base -t base-image:local .
skaffold build --push=false --file-output "$TMP_DIR/skaffold-artifacts.json"
python3 scripts/generate_sbom_reports.py \
  --artifacts "$TMP_DIR/skaffold-artifacts.json" \
  --sunshine "$SUNSHINE_CLI" \
  --sunshine-revision "${SUNSHINE_REVISION:-unknown}"
python3 "$ROOT_DIR/scripts/generate_architecture.py" \
  --artifacts "$TMP_DIR/skaffold-artifacts.json"
