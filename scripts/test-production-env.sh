#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
validator="$SCRIPT_DIR/validate-production-env.sh"
valid_env=(
  APP_ENV=production APP_DEBUG=false APP_URL=https://api.example.test
  APP_KEY=base64:ZmFrZS1rZXktZm9yLXRlc3RzLW9ubHk=
  DB_HOST=db.example.test DB_DATABASE=guider DB_USERNAME=guider_app DB_PASSWORD=test-only-password
  SESSION_SECURE_COOKIE=true SESSION_HTTP_ONLY=true SESSION_SAME_SITE=lax
  CORS_ALLOWED_ORIGINS=https://app.example.test SANCTUM_STATEFUL_DOMAINS=app.example.test
)
env "${valid_env[@]}" bash "$validator" >/dev/null
if env "${valid_env[@]}" CORS_ALLOWED_ORIGINS='*' bash "$validator" >/dev/null 2>&1; then echo "Wildcard CORS unexpectedly accepted." >&2; exit 1; fi
if env "${valid_env[@]}" SESSION_SECURE_COOKIE=false bash "$validator" >/dev/null 2>&1; then echo "Insecure cookies unexpectedly accepted." >&2; exit 1; fi
if env "${valid_env[@]}" APP_DEBUG=true bash "$validator" >/dev/null 2>&1; then echo "APP_DEBUG=true unexpectedly accepted." >&2; exit 1; fi
if env "${valid_env[@]}" APP_URL=http://api.example.test bash "$validator" >/dev/null 2>&1; then echo "HTTP APP_URL unexpectedly accepted." >&2; exit 1; fi
echo "Production environment validation tests passed."
