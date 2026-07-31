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
# Keep Dify bound to localhost on the Docker host and expose it to this
# container through host.docker.internal.
DIFY_API_BASE_URL=http://host.docker.internal:8081/v1
DIFY_API_KEY=
DIFY_RESPONSE_MODE=streaming
DIFY_INPUTS_JSON={}

REQUEST_TIMEOUT_MS=180000
MAX_CONCURRENT=1
RATE_LIMIT_REQUESTS=12

TZ=Europe/Madrid
ENV

chmod 600 "$ENV_FILE"
echo "Created $ENV_FILE for the self-hosted Dify chat proxy."
