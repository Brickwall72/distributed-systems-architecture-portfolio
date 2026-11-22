#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_REPOSITORY_OWNER:?GITHUB_REPOSITORY_OWNER is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

branch=demo-ui-published
reference="refs/heads/$branch"
worktree="$RUNNER_TEMP/dsap-demo-ui-publication"
previous="$RUNNER_TEMP/dsap-demo-ui-previous.json"
manifest="$RUNNER_TEMP/dsap-demo-ui-images.json"
owner="${GITHUB_REPOSITORY_OWNER,,}"
registry="ghcr.io/$owner"

if git ls-remote --exit-code origin "$reference" >/dev/null; then
  git fetch --no-tags origin "$reference"
  parent=FETCH_HEAD
  git show "$parent:demo-ui-images.json" > "$previous"
  python3 scripts/publish-demo-ui-images.py --source "$GITHUB_SHA" --registry "$registry" \
    --previous "$previous" --output "$manifest"
else
  status=$?
  if [[ "$status" -ne 2 ]]; then
    echo "Could not check the existing demo UI publication branch." >&2
    exit "$status"
  fi
  parent="$GITHUB_SHA"
  python3 scripts/publish-demo-ui-images.py --source "$GITHUB_SHA" --registry "$registry" \
    --output "$manifest"
fi

git worktree add --detach "$worktree" "$parent"
cp "$manifest" "$worktree/demo-ui-images.json"
git -C "$worktree" add demo-ui-images.json
if git -C "$worktree" diff --cached --quiet; then
  echo "Demo UI publication is unchanged."
  exit 0
fi
git -C "$worktree" -c user.name="github-actions[bot]" \
  -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -m "Update demo UI image manifest"
git -C "$worktree" push origin "HEAD:$reference"
