#!/usr/bin/env sh
set -eu
umask 077

PORT="${PORT:-10000}"
case "$PORT" in
  ""|*[!0-9]*) echo "Invalid PORT value." >&2; exit 1 ;;
esac

# Render assigns an HTTP port dynamically. Bind Apache to that port, on all
# interfaces. Do not print environment variables or confidential values.
sed -i "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Aiven CA is supplied in the hosting provider's protected environment, not
# checked into the repository. PDO MySQL uses this CA to verify server TLS.
if [ -n "${DB_SSL_CA_PEM:-}" ]; then
  printf '%s\n' "$DB_SSL_CA_PEM" > /tmp/mwecau-aiven-ca.pem
  chmod 600 /tmp/mwecau-aiven-ca.pem
  export MYSQL_ATTR_SSL_CA=/tmp/mwecau-aiven-ca.pem
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying Laravel database migrations."
  php artisan migrate --force --no-interaction
fi

exec apache2-foreground
