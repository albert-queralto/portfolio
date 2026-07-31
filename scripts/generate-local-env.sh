#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -e "$ENV_FILE" && "${1:-}" != "--force" ]]; then
  echo "$ENV_FILE already exists. Use --force to replace it." >&2
  exit 1
fi

cat > "$ENV_FILE" <<'ENV'
# Portfolio chat proxy -> self-hosted Dify.
# The Dify api service is reachable when ~/dify/docker uses
# dify/docker-compose.ollama-access.yaml from this repo.
DIFY_API_BASE_URL=http://api:5001/v1
DIFY_API_KEY=
DIFY_RESPONSE_MODE=streaming
DIFY_INPUTS_JSON={}

OLLAMA_CHAT_MODEL=gemma3:1b
OLLAMA_EMBEDDING_MODEL=embeddinggemma:300m-qat-q4_0
OLLAMA_CONTEXT_LENGTH=2048
OLLAMA_KEEP_ALIVE=60s
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_QUEUE=2
OLLAMA_MEMORY_LIMIT=1700m
OLLAMA_CPU_LIMIT=1.5

REQUEST_TIMEOUT_MS=180000
MAX_CONCURRENT=1
RATE_LIMIT_REQUESTS=12

TZ=Europe/Madrid
ENV

chmod 600 "$ENV_FILE"
echo "Created $ENV_FILE for the self-hosted Dify chat proxy."
