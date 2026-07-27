#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -e "$ENV_FILE" && "${1:-}" != "--force" ]]; then
  echo "$ENV_FILE already exists. Use --force to replace it." >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required." >&2
  exit 1
}

mysql_password="$(openssl rand -hex 32)"
minio_password="$(openssl rand -hex 32)"
redis_password="$(openssl rand -hex 32)"

cat > "$ENV_FILE" <<ENV
RAGFLOW_BASE_URL=http://ragflow
RAGFLOW_IMAGE=infiniflow/ragflow:v0.25.6
RAGFLOW_CHAT_ID=
RAGFLOW_API_KEY=
RAGFLOW_REGISTER_ENABLED=1

RAGFLOW_MYSQL_PASSWORD=$mysql_password
RAGFLOW_MINIO_USER=ragflow
RAGFLOW_MINIO_PASSWORD=$minio_password
RAGFLOW_REDIS_PASSWORD=$redis_password

OLLAMA_CHAT_MODEL=gemma3:1b
OLLAMA_EMBEDDING_MODEL=embeddinggemma:300m-qat-q4_0
OLLAMA_CONTEXT_LENGTH=2048
OLLAMA_KEEP_ALIVE=60s
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_QUEUE=2

OLLAMA_MEMORY_LIMIT=1700m
OLLAMA_CPU_LIMIT=1.5
RAGFLOW_APP_MEMORY_LIMIT=1800m
RAGFLOW_APP_CPU_LIMIT=1.5
RAGFLOW_INFINITY_MEMORY_LIMIT=700m
RAGFLOW_INFINITY_CPU_LIMIT=0.75
RAGFLOW_MYSQL_MEMORY_LIMIT=420m
RAGFLOW_MYSQL_CPU_LIMIT=0.50
RAGFLOW_MINIO_MEMORY_LIMIT=256m
RAGFLOW_MINIO_CPU_LIMIT=0.35
RAGFLOW_REDIS_MEMORY_LIMIT=160m
RAGFLOW_REDIS_CPU_LIMIT=0.20
RAGFLOW_DOC_BULK_SIZE=1
RAGFLOW_EMBEDDING_BATCH_SIZE=1
RAGFLOW_THREAD_POOL_MAX_WORKERS=8

TZ=America/Guatemala
ENV

chmod 600 "$ENV_FILE"
echo "Created $ENV_FILE with random local service passwords."
