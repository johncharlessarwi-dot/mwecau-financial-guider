#!/usr/bin/env bash
set -Eeuo pipefail
set +x
failures=0
fail() { printf 'FAIL: %s\n' "$1" >&2; failures=$((failures + 1)); }
require_value() { local name="$1"; [[ -n "${!name:-}" ]] || fail "$name must be set"; }
[[ "${APP_ENV:-}" == "production" ]] || fail "APP_ENV must equal production"
[[ "${APP_DEBUG:-true}" == "false" ]] || fail "APP_DEBUG must be false"
[[ "${APP_URL:-}" == https://* ]] || fail "APP_URL must use HTTPS"
[[ -n "${APP_KEY:-}" && "${APP_KEY:-}" != "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" ]] || fail "APP_KEY must be a real generated key"
for name in DB_HOST DB_DATABASE DB_USERNAME DB_PASSWORD; do require_value "$name"; done
[[ "${SESSION_SECURE_COOKIE:-false}" == "true" ]] || fail "SESSION_SECURE_COOKIE must be true"
[[ "${SESSION_HTTP_ONLY:-false}" == "true" ]] || fail "SESSION_HTTP_ONLY must be true"
case "${SESSION_SAME_SITE:-}" in lax|strict) ;; *) fail "SESSION_SAME_SITE must be lax or strict for this deployment profile" ;; esac
cors="${CORS_ALLOWED_ORIGINS:-}"
if [[ -z "$cors" ]]; then fail "CORS_ALLOWED_ORIGINS must contain explicit production origins"
elif [[ "$cors" == *"*"* ]]; then fail "CORS_ALLOWED_ORIGINS must not contain wildcard origins"
else
  IFS=',' read -r -a origins <<< "$cors"
  for origin in "${origins[@]}"; do
    origin="$(printf '%s' "$origin" | xargs)"
    [[ "$origin" == https://* ]] || fail "Every CORS origin must use HTTPS"
    [[ "$origin" != *localhost* && "$origin" != *127.0.0.1* ]] || fail "Local development origins are not allowed in production"
  done
fi
stateful="${SANCTUM_STATEFUL_DOMAINS:-}"
[[ -n "$stateful" ]] || fail "SANCTUM_STATEFUL_DOMAINS must list the frontend host (without scheme)"
if [[ "$stateful" == *"://"* || "$stateful" == *"*"* ]]; then fail "SANCTUM_STATEFUL_DOMAINS must contain hostnames only and no wildcard"; fi
if (( failures > 0 )); then
  printf 'Production environment validation failed with %d issue(s).\n' "$failures" >&2
  exit 1
fi
printf 'Production environment validation passed. No secret values were printed.\n'
