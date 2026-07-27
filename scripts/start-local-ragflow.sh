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

./scripts/prepare-ragflow-documents.sh
mkdir -p ragflow/logs certbot/www certbot/conf

# Pull first so failures are visible before any service is replaced.
docker compose pull ollama ragflow ragflow-mysql ragflow-minio ragflow-redis ragflow-infinity reverse-proxy certbot

docker compose up -d --build

echo
echo "Containers started. Follow RAGFlow startup with:"
echo "  docker compose logs -f ragflow"
echo
echo "The Ollama model pull runs in the albert-ollama-init one-shot container."
echo "Check it with: docker compose logs ollama-init"
