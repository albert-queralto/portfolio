#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required." >&2
  exit 1
}

docker compose version >/dev/null

if [[ ! -f .env ]]; then
  ./scripts/generate-local-env.sh
fi

./scripts/prepare-chatbot-documents.sh
mkdir -p certbot/www certbot/conf

# Pull first so failures are visible before any service is replaced.
docker compose pull reverse-proxy certbot

docker compose up -d --build

echo
echo "Portfolio chatbot containers started."
echo "Follow the chat proxy with:"
echo "  docker compose logs -f chat-api"
echo
echo "Self-hosted Dify must be running separately at DIFY_API_BASE_URL."
