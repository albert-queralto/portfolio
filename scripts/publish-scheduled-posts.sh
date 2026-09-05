#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/albert/portfolio"
LOCK_FILE="/tmp/portfolio-publish.lock"

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[portfolio-publish] Another deployment is already running."
  exit 0
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

echo "[portfolio-publish] Building portfolio"
docker compose build

echo "[portfolio-publish] Deploying portfolio"
docker compose up -d

echo "[portfolio-publish] Current containers"
docker compose ps

echo "[portfolio-publish] Scheduling next publication"
python3 "$APP_DIR/scripts/schedule-next-post.py"

echo "[portfolio-publish] Completed at $(date --iso-8601=seconds)"
