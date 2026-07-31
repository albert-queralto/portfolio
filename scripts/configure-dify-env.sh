#!/usr/bin/env bash
set -euo pipefail

DIFY_ENV="${1:-$HOME/dify/docker/.env}"

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
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) print key "=" value
    }
  ' "$DIFY_ENV" > "$tmp"
  mv "$tmp" "$DIFY_ENV"
}

upsert_env CONSOLE_API_URL "http://127.0.0.1:8081"
upsert_env CONSOLE_WEB_URL "http://127.0.0.1:8081"
upsert_env SERVICE_API_URL "http://127.0.0.1:8081"
upsert_env APP_API_URL "http://127.0.0.1:8081"
upsert_env APP_WEB_URL "http://127.0.0.1:8081"
upsert_env FILES_URL "http://127.0.0.1:8081"
upsert_env TRIGGER_URL "http://127.0.0.1:8081"
upsert_env ENDPOINT_URL_TEMPLATE "http://127.0.0.1:8081/e/{hook_id}"
upsert_env NEXT_PUBLIC_SOCKET_URL "ws://127.0.0.1:8081"
upsert_env EXPOSE_NGINX_PORT "127.0.0.1:8081"
upsert_env EXPOSE_NGINX_SSL_PORT "127.0.0.1:8444"
upsert_env NGINX_HTTPS_ENABLED "false"

echo "Updated $DIFY_ENV for the portfolio Dify + Ollama setup."
echo "Backup saved at $backup"
echo
echo "Set INIT_PASSWORD in $DIFY_ENV before first start if it is still empty."
