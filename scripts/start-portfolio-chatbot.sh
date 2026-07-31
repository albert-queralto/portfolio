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
docker compose pull ollama ollama-init reverse-proxy certbot

docker compose up -d --build

echo
echo "Portfolio chatbot containers started."
echo "Follow the chat proxy with:"
echo "  docker compose logs -f chat-api"
echo
echo "The Ollama model pull runs in the albert-ollama-init one-shot container."
echo "Check it with: docker compose logs ollama-init"
echo
echo "Self-hosted Dify must be running separately and attached to the local-ai network."
