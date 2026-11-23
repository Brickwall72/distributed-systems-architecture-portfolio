#!/usr/bin/env sh
set -eu

cluster_name="platform-cluster"

if ! command -v docker >/dev/null 2>&1 || ! command -v k3d >/dev/null 2>&1; then
	echo "Docker CLI and k3d are required." >&2
	exit 127
fi

node_ids="$(docker ps --all --quiet --filter "name=k3d-$cluster_name-")"
volume_names=""
if [ -n "$node_ids" ]; then
	volume_names="$(docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{"\n"}}{{end}}{{end}}' $node_ids | sort -u)"
fi

if ! k3d cluster get "$cluster_name" >/dev/null 2>&1; then
	echo "k3d cluster $cluster_name does not exist."
	exit 0
fi

k3d cluster delete "$cluster_name"

if [ -n "$volume_names" ]; then
	for volume_name in $volume_names; do
		if docker volume inspect "$volume_name" >/dev/null 2>&1; then
			docker volume rm "$volume_name"
		fi
	done
fi