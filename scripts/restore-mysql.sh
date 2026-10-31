#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

required=(DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD BACKUP_FILE AGE_IDENTITY_FILE RESTORE_CONFIRM)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 2
  fi
done

if [[ "$RESTORE_CONFIRM" != "YES" ]]; then
  echo "Refusing restore. Set RESTORE_CONFIRM=YES after verifying the target database." >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" || ! -f "$BACKUP_FILE.sha256" || ! -f "$AGE_IDENTITY_FILE" ]]; then
  echo "Backup, checksum, or age identity file is missing." >&2
  exit 2
fi
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 2; }
command -v age >/dev/null || { echo "age is required." >&2; exit 2; }
command -v gzip >/dev/null || { echo "gzip is required." >&2; exit 2; }
command -v mysql >/dev/null || { echo "mysql client is required." >&2; exit 2; }

(
  cd "$(dirname "$BACKUP_FILE")"
  sha256sum --check "$(basename "$BACKUP_FILE").sha256"
)
export MYSQL_PWD="$DB_PASSWORD"
trap 'unset MYSQL_PWD' EXIT

age --decrypt --identity "$AGE_IDENTITY_FILE" "$BACKUP_FILE" \
  | gzip --decompress \
  | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" "$DB_DATABASE"

unset MYSQL_PWD
trap - EXIT
echo "Restore stream completed. Run the documented post-restore validation before reopening application traffic."
