#!/usr/bin/env sh
set -eu

# Vendors platform-lib into every consuming chart's charts/ dir. Run once after
# clone and whenever charts/platform-lib or a chart's own dependencies change.

for chart in charts/esign-service charts/pdf-service charts/compliance-service charts/topology-service \
             charts/global-shell charts/topology-shell charts/compliance-shell \
             charts/dbgate charts/minio; do
  if [ -d "$chart/charts" ]; then
    for sub in "$chart"/charts/*/; do
      [ -f "${sub}Chart.yaml" ] && helm dependency update "${sub%/}"
    done
  fi
  helm dependency update "$chart"
done

echo "Chart dependencies updated."
