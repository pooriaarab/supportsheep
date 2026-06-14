#!/usr/bin/env bash
set -euo pipefail

# dev-worktree.sh — Start dev server with portless + d3k.
# Gives each worktree a named URL: http://sb-<branch>.localhost:1355
# Main repo gets: http://sb-main.localhost:1355

for cmd in portless d3k; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "[dev] ERROR: '$cmd' not found. Install it first." >&2; exit 1; }
done

MAIN_ROOT="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
WORKTREE_ROOT="$(git rev-parse --show-toplevel)"

if [ "$MAIN_ROOT" = "$WORKTREE_ROOT" ]; then
  NAME="sb-main"
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
  NAME="sb-$BRANCH"
fi

echo "[dev] Starting portless + d3k"
echo "[dev] URL: http://$NAME.localhost:1355"
echo ""

exec portless "$NAME" d3k -s dev:next
