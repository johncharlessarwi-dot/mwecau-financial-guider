#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${BACKUP_S3_URI:?Set BACKUP_S3_URI to a private s3://bucket/prefix destination}"
: "${BACKUP_DIR:?Set BACKUP_DIR to a protected local temporary directory}"
command -v aws >/dev/null || { echo "AWS CLI v2 is required for S3-compatible upload." >&2; exit 2; }
[[ "$BACKUP_S3_URI" == s3://* ]] || { echo "BACKUP_S3_URI must start with s3://." >&2; exit 2; }
BACKUP_S3_URI="${BACKUP_S3_URI%/}"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
backup_output="$(bash "$SCRIPT_DIR/backup-mysql.sh")"
printf '%s\n' "$backup_output"
backup_file="$(printf '%s\n' "$backup_output" | sed -n 's/^Encrypted backup created: //p' | tail -n 1)"
[[ -n "$backup_file" && -s "$backup_file" ]] || { echo "Could not locate encrypted backup artifact." >&2; exit 1; }
checksum_file="$backup_file.sha256"
[[ -s "$checksum_file" ]] || { echo "Backup checksum file is missing." >&2; exit 1; }
upload_file() {
  local file="$1" prefix="$2" destination="$BACKUP_S3_URI/$prefix/$(basename "$file")"
  local -a encryption_args
  case "${BACKUP_S3_SSE:-aws:kms}" in
    aws:kms)
      encryption_args=(--sse aws:kms)
      if [[ -n "${BACKUP_S3_KMS_KEY_ID:-}" ]]; then
        encryption_args+=(--sse-kms-key-id "$BACKUP_S3_KMS_KEY_ID")
      fi
      ;;
    AES256) encryption_args=(--sse AES256) ;;
    *) echo "BACKUP_S3_SSE must be aws:kms or AES256." >&2; return 2 ;;
  esac
  aws s3 cp "$file" "$destination" "${encryption_args[@]}" --only-show-errors
  printf 'Uploaded and server-side encrypted: %s\n' "$destination"
  if [[ "$file" == *.age ]]; then
    local bucket key remote_size local_size
    bucket="$(printf '%s' "$destination" | sed -E 's#^s3://([^/]+)/.*#\1#')"
    key="$(printf '%s' "$destination" | sed -E 's#^s3://[^/]+/##')"
    remote_size="$(aws s3api head-object --bucket "$bucket" --key "$key" --query ContentLength --output text)"
    local_size="$(wc -c < "$file" | tr -d ' ')"
    [[ "$remote_size" == "$local_size" ]] || { echo "Uploaded object size verification failed." >&2; return 1; }
  fi
}
upload_file "$backup_file" daily
upload_file "$checksum_file" daily
if [[ "$(date -u +%d)" == "01" ]]; then
  upload_file "$backup_file" monthly
  upload_file "$checksum_file" monthly
fi
echo "Cloud upload completed. Bucket lifecycle retention must be configured separately using infra/aws/s3-backup-lifecycle.json."
