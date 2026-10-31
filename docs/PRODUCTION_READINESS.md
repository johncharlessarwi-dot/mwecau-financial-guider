# Production Readiness — Evidence and Go/No-Go Checklist

This checklist separates repository/CI evidence from production operations. A green CI run does not prove that a live database, cloud backup, deployed environment, or real device has been tested.

## Verified in repository CI

- [x] Web dependency audit completes without a blocking vulnerability.
- [x] Web TypeScript typecheck passes.
- [x] Web unit and IndexedDB integration tests pass.
- [x] Web production build completes, including PWA build verification.
- [x] Laravel Composer manifest validation passes.
- [x] PHP dependency audit completes without known advisories.
- [x] Laravel feature tests pass on both SQLite and MySQL 8.4 for authentication, authorization, tenant isolation, ledger behavior, transfers, idempotency, and financial audit events.
- [x] Financial account and transaction writes roll back if audit-log persistence fails; transfer debit/credit pairs roll back together.
- [x] Backup and restore shell scripts pass Bash syntax validation.
- [x] CI exercises real age encryption/decryption, SHA-256 verification, tamper rejection, and explicit restore confirmation using a non-production fixture.
- [x] Login and authenticated read rate limits, mobile token expiry, and token revocation have regression tests.
- [x] Offline queue tests verify AES-GCM encryption, separate snapshot/outbox keys, preservation on session expiry, retry ordering, and stable idempotency keys.
- [x] Client-side offline sync integration tests cover successful delivery, network failure, session expiry, and retry after a lost response.
- [x] Financial report category ordering is deterministic across SQLite and MySQL 8.4.

## Production work still requiring infrastructure or operator access

- [ ] Configure the production MySQL database, network restrictions, TLS, least-privilege service accounts, and connection limits.
- [ ] Configure managed encrypted database backups and point-in-time recovery in the hosting provider.
- [ ] Store the age private identity and database credentials in a managed secret store; never put them in Git or chat.
- [ ] Configure private object storage, access controls, object versioning/immutability, monitoring, and an approved retention schedule.
- [ ] Execute a real backup against a non-production database and verify encrypted artifact upload plus checksum.
- [ ] Execute a restore drill into an isolated recovery database; verify schema, foreign keys, ledger balances, transfer pairs, idempotency records, and audit logs.
- [ ] Record measured RPO/RTO and assign a backup/restore owner and alert destination.
- [ ] Configure production HTTPS, exact CORS origins, secure session cookies, trusted proxy settings, and production-only secrets.
- [ ] Run staging browser/device smoke tests for login, logout, session expiry, offline queue, reconnect, duplicate retry, and account isolation.
- [ ] Run load, rate-limit, database-failure, and recovery tests against staging infrastructure.
- [ ] Verify monitoring, error reporting, alert delivery, secret rotation, and incident response procedures.
- [ ] Obtain a final security and product-owner sign-off before enabling production traffic.

## Release gate

Do not declare production-ready while any of the following is missing:

1. A successful isolated restore drill from a real encrypted backup.
2. Verified production secrets, TLS, CORS, and secure cookie settings.
3. A staging end-to-end smoke test with the deployed API and web client.
4. Evidence that offline retries cannot duplicate a committed financial transaction.
5. A documented rollback and incident-response owner.

## Current evidence boundary

The repository currently contains automated test coverage and backup/restore tooling. It does **not** contain production credentials or a configured cloud backup provider, and no live restore drill or production deployment is claimed by this checklist. Complete the infrastructure-dependent items in the target hosting environment before calling the service production-ready.
