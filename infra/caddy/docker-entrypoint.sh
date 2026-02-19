#!/bin/sh
set -eu

TOKEN_FILE="/run/secrets/cloudflare_api_token"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "${TOKEN_FILE}" ]; then
  export CLOUDFLARE_API_TOKEN="$(cat "${TOKEN_FILE}")"
fi

exec "$@"
