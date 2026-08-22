#!/usr/bin/env bash
set -euo pipefail

mode="${1:-webroot}"
cert_name="${CERTBOT_CERT_NAME:-albertqueralto.dev}"
email="${CERTBOT_EMAIL:-albert@albertqueralto.dev}"

domains=(
  "albertqueralto.dev"
  "www.albertqueralto.dev"
  "payrithm.albertqueralto.dev"
  "catalonia-weather-app.albertqueralto.dev"
  "tenderwise.albertqueralto.dev"
  "wfpp.albertqueralto.dev"
  "traceleaf.albertqueralto.dev"
)

usage() {
  cat <<'USAGE'
Usage:
  scripts/issue-letsencrypt-cert.sh webroot
  scripts/issue-letsencrypt-cert.sh standalone

Modes:
  webroot     Use the running reverse-proxy and /.well-known/acme-challenge/.
              Use this when nginx already starts with an existing certificate.

  standalone  Stop reverse-proxy and let certbot bind port 80 itself.
              Use this for the first certificate, when nginx cannot start yet.

Environment:
  CERTBOT_EMAIL       Defaults to albert@albertqueralto.dev.
  CERTBOT_CERT_NAME   Defaults to albertqueralto.dev.
  CERTBOT_STAGING=1   Use Let's Encrypt staging for a test run.
USAGE
}

case "$mode" in
  webroot | standalone)
    ;;
  -h | --help | help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

mkdir -p certbot/www certbot/conf

domain_args=()
for domain in "${domains[@]}"; do
  domain_args+=("-d" "$domain")
done

common_args=(
  certonly
  --non-interactive
  --agree-tos
  --email "$email"
  --no-eff-email
  --cert-name "$cert_name"
  --expand
  "${domain_args[@]}"
)

if [[ "${CERTBOT_STAGING:-0}" == "1" ]]; then
  common_args+=(--staging)
fi

if [[ "$mode" == "webroot" ]]; then
  if ! docker compose up -d reverse-proxy; then
    echo "reverse-proxy could not start. If this is the first certificate, run:" >&2
    echo "  scripts/issue-letsencrypt-cert.sh standalone" >&2
    exit 1
  fi

  docker compose run --rm certbot \
    "${common_args[@]}" \
    --webroot \
    --webroot-path /var/www/certbot
else
  docker compose stop reverse-proxy || true

  docker compose run --rm -p 80:80 certbot \
    "${common_args[@]}" \
    --standalone \
    --preferred-challenges http
fi

docker compose up -d reverse-proxy
docker compose exec reverse-proxy nginx -t
docker compose exec reverse-proxy nginx -s reload
