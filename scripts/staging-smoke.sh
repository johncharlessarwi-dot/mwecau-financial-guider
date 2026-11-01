#!/usr/bin/env bash
set -Eeuo pipefail
set +x
: "${STAGING_WEB_URL:?Set STAGING_WEB_URL to deployed staging frontend URL}"
: "${STAGING_API_URL:?Set STAGING_API_URL to deployed staging API origin}"
: "${STAGING_WEB_ORIGIN:?Set STAGING_WEB_ORIGIN to exact frontend origin}"
for url in "$STAGING_WEB_URL" "$STAGING_API_URL" "$STAGING_WEB_ORIGIN"; do
  [[ "$url" == https://* ]] || { echo "All staging URLs/origins must use HTTPS." >&2; exit 1; }
done
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl --fail --silent --show-error --location --max-time 20 -D "$tmp/web.headers" -o /dev/null "$STAGING_WEB_URL"
grep -Eiq '^strict-transport-security:.*max-age=' "$tmp/web.headers" || { echo "Frontend missing HSTS." >&2; exit 1; }
curl --fail --silent --show-error --max-time 20 -D "$tmp/api.headers" -o "$tmp/health.json" "${STAGING_API_URL%/}/api/v1/health"
grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$tmp/health.json" || { echo "API health did not return status=ok." >&2; exit 1; }
grep -Eiq '^strict-transport-security:.*max-age=' "$tmp/api.headers" || { echo "API missing HSTS." >&2; exit 1; }
curl --silent --show-error --max-time 20 -X OPTIONS \
  -H "Origin: $STAGING_WEB_ORIGIN" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-xsrf-token' \
  -D "$tmp/cors.headers" -o /dev/null "${STAGING_API_URL%/}/api/v1/auth/login"
actual_origin="$(sed -n '/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin:/ { s/^[^:]*:[[:space:]]*//; s/\r$//; p; }' "$tmp/cors.headers" | head -n 1)"
[[ "$actual_origin" == "$STAGING_WEB_ORIGIN" ]] || { echo "CORS did not return exact staging origin." >&2; exit 1; }
grep -Eiq '^access-control-allow-credentials:[[:space:]]*true' "$tmp/cors.headers" || { echo "CORS credentials are not enabled for approved origin." >&2; exit 1; }
echo "Staging HTTPS, API health, HSTS and CORS smoke checks passed."
