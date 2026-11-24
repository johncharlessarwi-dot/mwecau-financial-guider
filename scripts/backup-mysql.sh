#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

required=(DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD BACKUP_AGE_RECIPIENT BACKUP_DIR)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 2
  fi
done

command -v mysqldump >/dev/null || { echo "mysqldump is required." >&2; exit 2; }
command -v gzip >/dev/null || { echo "gzip is required." >&2; exit 2; }
command -v age >/dev/null || { echo "age is required." >&2; exit 2; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 2; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/${DB_DATABASE}-${timestamp}.sql.gz.age"
temporary="$output.partial"
export MYSQL_PWD="$DB_PASSWORD"
trap 'rm -f "$temporary"; unset MYSQL_PWD' EXIT

mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" \
  --single-transaction --quick --routines --triggers --events --no-tablespaces \
  --hex-blob --default-character-set=utf8mb4 "$DB_DATABASE" \
  | gzip -9 \
  | age --recipient "$BACKUP_AGE_RECIPIENT" --output "$temporary"

test -s "$temporary"
mv "$temporary" "$output"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$output")" > "$(basename "$output").sha256")
chmod 600 "$output" "$output.sha256"
unset MYSQL_PWD
trap - EXIT
printf 'Encrypted backup created: %s\n' "$output"
printf 'Checksum created: %s.sha256\n' "$output"
