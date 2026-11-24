# Database Backup and Recovery Runbook

This runbook is for the Laravel MySQL production database. The repository does not contain production credentials or a configured cloud backup provider. Operators must configure the hosting provider's encrypted automated backups and test restores in a separate staging database before production launch.

## Security requirements

- Use a dedicated least-privilege database account for backups; it needs read access and the privileges required to dump routines, triggers, and events. Use a separate restore account for recovery.
- Keep the age encryption identity (private key) in a managed secret store or offline restricted vault. Store only the age **recipient** (public key) in the backup job environment.
- Store encrypted backup files outside the repository in private object storage with server-side encryption, restricted IAM, access logging, and object versioning or immutability where available.
- Never place database passwords, age identity files, plaintext SQL dumps, or real financial data in Git, CI logs, public buckets, or issue attachments.
- Enforce a retention schedule approved by the data owner and applicable privacy requirements. Expire old objects using the storage provider's lifecycle policy; do not run unreviewed destructive cleanup commands.
- Prefer managed point-in-time recovery in addition to periodic logical backups. Define and approve RPO/RTO targets before production use.

## Create an encrypted logical backup

The script streams `mysqldump` through gzip and age encryption; it does not intentionally write a plaintext SQL dump to disk.

Required tools: Bash, MySQL client utilities, gzip, age, and sha256sum.

Set these environment variables in a protected shell or secret manager (never commit them):

- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `BACKUP_AGE_RECIPIENT`: age public recipient, not the private identity
- `BACKUP_DIR`: private local staging directory that is synced to approved private object storage

Run:

```bash
bash scripts/backup-mysql.sh
```

The output is a timestamped `.sql.gz.age` file plus a SHA-256 checksum. Transfer both files to private object storage, verify the upload, and restrict access. Local staging should be on encrypted storage and cleared according to the approved retention policy.

## Restore into an isolated recovery database

**Never test a restore over production.** Provision an isolated recovery database with a compatible MySQL version and sufficient capacity. Verify the backup object and checksum first.

Required variables:

- The same `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` variables, pointing to the isolated recovery database
- `BACKUP_FILE`: path to the encrypted backup
- `AGE_IDENTITY_FILE`: path to the private age identity, retrieved securely
- `RESTORE_CONFIRM=YES`: explicit acknowledgement that the target database is the intended recovery database

Run:

```bash
bash scripts/restore-mysql.sh
```

The restore script verifies the checksum before decrypting and streaming SQL into the target database. The restore account should have only the privileges required for the recovery operation.

## Post-restore verification checklist

1. Confirm the restore command exited successfully and database migrations are in the expected state.
2. Run `php artisan migrate:status` from `api/`; do not run new migrations automatically as part of the restore.
3. Run the API feature test suite against a disposable test database, not the restored financial data.
4. Verify row counts and referential integrity for users, accounts, transactions, transfer references, idempotency records, and audit logs using approved, non-sensitive aggregate checks.
5. Reconcile account balances from opening balances and confirmed ledger entries; verify transfer pairs remain linked and totals reconcile.
6. Verify application access, authentication, authorization, and health checks in the isolated environment.
7. Record backup timestamp, restore duration, checksum, migration state, validation outcome, operator, and any exceptions without recording personal financial values.
8. Obtain sign-off before switching traffic. Preserve the previous production database snapshot until the recovery is accepted.

## Operational status

A script in source control is not proof that production backups are running. Before launch, record the actual backup provider, schedule, retention, encryption-key custodian, alert destination, last successful backup, last successful isolated restore drill, measured RPO/RTO, and accountable operator.
