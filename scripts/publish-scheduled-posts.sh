#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/albert/portfolio"
LOCK_FILE="/tmp/portfolio-publish.lock"

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[portfolio-publish] Another deployment is already running."
  exit 0
fi

AVAILABLE_KB="$(df --output=avail "$APP_DIR" | tail -1 | tr -d ' ')"
MIN_FREE_KB=$((3 * 1024 * 1024))

if (( AVAILABLE_KB < MIN_FREE_KB )); then
  echo "[portfolio-publish] Less than 3 GB free. Cleaning Docker build cache."

  docker builder prune -a -f
  docker image prune -f

  AVAILABLE_KB="$(df --output=avail "$APP_DIR" | tail -1 | tr -d ' ')"

  if (( AVAILABLE_KB < MIN_FREE_KB )); then
    echo "[portfolio-publish] ERROR: still less than 3 GB free after cleanup."
    df -h "$APP_DIR"
    exit 1
  fi
fi

cd "$APP_DIR"

echo "[portfolio-publish] Started at $(date --iso-8601=seconds)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[portfolio-publish] Repository contains local changes. Aborting."
  git status --short
  exit 1
fi

echo "[portfolio-publish] Pulling latest commit"
git pull --ff-only

BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[portfolio-publish] Building portfolio at ${BUILD_TIMESTAMP}"
docker compose build \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  portfolio

echo "[portfolio-publish] Deploying portfolio"

docker compose up -d --no-deps portfolio

echo "[portfolio-publish] Current containers"
docker compose ps

echo "[portfolio-publish] Removing dangling Docker images"
docker image prune -f

echo "[portfolio-publish] Removing build cache older than 7 days"
docker builder prune -f --filter "until=168h"

echo "[portfolio-publish] Scheduling next publication"
python3 "$APP_DIR/scripts/schedule-next-post.py"

echo "[portfolio-publish] Completed at $(date --iso-8601=seconds)"
