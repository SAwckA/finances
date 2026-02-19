#!/bin/sh
set -eu

API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000}"
API_BASE_URL="${API_BASE_URL%/}"

cat > /app/public/env-config.js <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL}"
};
EOF

exec "$@"
