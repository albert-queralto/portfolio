#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/home/albert/portfolio"

cd "$APP_DIR"

echo "Updating repository..."
git pull --ff-only

echo "Building portfolio..."
docker compose build

echo "Deploying portfolio..."
docker compose up -d

echo "Scheduling next publication..."
node scripts/schedule-next-post.mjs