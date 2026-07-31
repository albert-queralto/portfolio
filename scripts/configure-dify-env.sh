#!/usr/bin/env bash
set -euo pipefail

DIFY_ENV="${1:-$HOME/dify/docker/.env}"
DIFY_CONSOLE_HOST="${DIFY_CONSOLE_HOST:-127.0.0.1}"
DIFY_CONSOLE_PORT="${DIFY_CONSOLE_PORT:-18081}"
DIFY_CONSOLE_SSL_PORT="${DIFY_CONSOLE_SSL_PORT:-18444}"
DIFY_CONSOLE_ORIGIN="http://$DIFY_CONSOLE_HOST:$DIFY_CONSOLE_PORT"
DIFY_CONSOLE_SOCKET_ORIGIN="ws://$DIFY_CONSOLE_HOST:$DIFY_CONSOLE_PORT"

if [[ ! -f "$DIFY_ENV" ]]; then
  echo "Dify env file not found: $DIFY_ENV" >&2
  echo "Create it first with: cp ~/dify/docker/.env.example ~/dify/docker/.env" >&2
  exit 1
fi

backup="$DIFY_ENV.backup.$(date +%Y%m%d-%H%M%S)"
cp "$DIFY_ENV" "$backup"

upsert_env() {
  local key="$1"
  local value="$2"
  local tmp

  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    {
      line = $0
      sub(/\r$/, "", line)
    }
    line ~ "^[[:space:]]*(export[[:space:]]+)?" key "[[:space:]]*=" {
      if (!updated) {
        print key "=" value
        updated = 1
      }
      next
    }
    { print }
    END {
      if (!updated) print key "=" value
    }
  ' "$DIFY_ENV" > "$tmp"
  mv "$tmp" "$DIFY_ENV"
}

upsert_env CONSOLE_API_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env CONSOLE_WEB_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env SERVICE_API_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env APP_API_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env APP_WEB_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env FILES_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env TRIGGER_URL "$DIFY_CONSOLE_ORIGIN"
upsert_env ENDPOINT_URL_TEMPLATE "$DIFY_CONSOLE_ORIGIN/e/{hook_id}"
upsert_env NEXT_PUBLIC_SOCKET_URL "$DIFY_CONSOLE_SOCKET_ORIGIN"
upsert_env EXPOSE_NGINX_PORT "$DIFY_CONSOLE_HOST:$DIFY_CONSOLE_PORT"
upsert_env EXPOSE_NGINX_SSL_PORT "$DIFY_CONSOLE_HOST:$DIFY_CONSOLE_SSL_PORT"
upsert_env NGINX_HTTPS_ENABLED "false"

echo "Updated $DIFY_ENV for the portfolio Dify + Ollama setup."
echo "Backup saved at $backup"
echo "Dify console URL on the VM: $DIFY_CONSOLE_ORIGIN"
echo
echo "Set INIT_PASSWORD in $DIFY_ENV before first start if it is still empty."
