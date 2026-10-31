#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary_root="$(mktemp -d)"
trap 'rm -rf "$temporary_root"' EXIT

command -v age-keygen >/dev/null || { echo "age-keygen is required for this test." >&2; exit 2; }
mkdir -p "$temporary_root/bin" "$temporary_root/backups"

cat > "$temporary_root/bin/mysqldump" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' 'CREATE TABLE backup_fixture (id INT PRIMARY KEY, value VARCHAR(80));'
printf '%s\n' "INSERT INTO backup_fixture VALUES (1, 'fixture-sensitive-row');"
MOCK

cat > "$temporary_root/bin/mysql" <<'MOCK'
#!/usr/bin/env bash
cat > "$RESTORE_CAPTURE_FILE"
MOCK
chmod 700 "$temporary_root/bin/mysqldump" "$temporary_root/bin/mysql"

age-keygen -o "$temporary_root/identity" >/dev/null 2>&1
recipient="$(age-keygen -y "$temporary_root/identity")"

export PATH="$temporary_root/bin:$PATH"
export DB_HOST="127.0.0.1"
export DB_PORT="3306"
export DB_DATABASE="backup_fixture"
export DB_USERNAME="backup_test"
export DB_PASSWORD="not-a-real-password"
export BACKUP_AGE_RECIPIENT="$recipient"
export BACKUP_DIR="$temporary_root/backups"

bash "$root/scripts/backup-mysql.sh"
backup_file="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql.gz.age' -print -quit)"
[[ -n "$backup_file" && -s "$backup_file" ]] || { echo "Encrypted backup artifact was not created." >&2; exit 1; }
[[ -s "$backup_file.sha256" ]] || { echo "Backup checksum was not created." >&2; exit 1; }

if grep -a -q 'fixture-sensitive-row' "$backup_file"; then
  echo "Backup artifact contains plaintext fixture data." >&2
  exit 1
fi

(
  cd "$BACKUP_DIR"
  sha256sum --check "$(basename "$backup_file").sha256"
)


expected_hash=""
read -r expected_hash _ < "$backup_file.sha256"
tampered_file="$BACKUP_DIR/tampered.sql.gz.age"
cp "$backup_file" "$tampered_file"
printf 'tampered' >> "$tampered_file"
printf '%s  %s\\n' "$expected_hash" "$(basename "$tampered_file")" > "$tampered_file.sha256"
export BACKUP_FILE="$tampered_file"
export AGE_IDENTITY_FILE="$temporary_root/identity"
export RESTORE_CONFIRM="YES"
export RESTORE_CAPTURE_FILE="$temporary_root/tampered.sql"

if bash "$root/scripts/restore-mysql.sh" >/dev/null 2>&1; then
  echo "Restore unexpectedly accepted a tampered backup." >&2
  exit 1
fi
[[ ! -s "$RESTORE_CAPTURE_FILE" ]] || {
  echo "Tampered backup reached the MySQL restore client." >&2
  exit 1
}

export BACKUP_FILE="$backup_file"
export AGE_IDENTITY_FILE="$temporary_root/identity"
export RESTORE_CAPTURE_FILE="$temporary_root/restored.sql"

if RESTORE_CONFIRM="NO" bash "$root/scripts/restore-mysql.sh" >/dev/null 2>&1; then
  echo "Restore unexpectedly accepted a missing explicit confirmation." >&2
  exit 1
fi

export RESTORE_CONFIRM="YES"
bash "$root/scripts/restore-mysql.sh"
grep -q 'fixture-sensitive-row' "$RESTORE_CAPTURE_FILE" || {
  echo "Restored SQL does not contain the expected fixture." >&2
  exit 1
}

echo "Encrypted backup, checksum verification, guarded restore, and decrypted fixture validation passed."
