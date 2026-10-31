# MWECau Financial Guider — Production Operations Runbook

**Status:** provider-neutral implementation guide; not evidence of a completed production deployment.

This runbook is for the Laravel API, MySQL database, and Vite/PWA frontend. The actual hosting provider, staging URL, cloud account, and secret manager have not been identified. Do not run infrastructure commands until the target account and environment are confirmed.

## 1. Cloud backups and retention

### Required architecture
- Enable the database provider's managed automated backups and point-in-time recovery (PITR), if supported.
- Keep a second encrypted logical backup outside the database provider's account or failure domain.
- Use a private S3-compatible bucket with public access blocked, versioning enabled, server-side encryption (prefer customer-managed KMS), least-privilege IAM, and access logging.
- Store the age private identity and database credentials only in a managed secret store. The upload job needs the public age recipient; restore operators need the private identity.
- Run scripts/backup-mysql-s3.sh from a trusted scheduled runner. It invokes the existing encrypted mysqldump workflow, uploads artifact and checksum, and verifies uploaded artifact size.
- Configure lifecycle rules from infra/aws/s3-backup-lifecycle.json. The example assumes bucket prefix mwecau-guider/: daily artifacts expire after 35 days; monthly artifacts expire after 400 days. Monthly copies are created on the first UTC day of each month.
- Set provider-native database backup retention independently. Suggested starting target: PITR coverage of at least 7 days and daily managed snapshots for 35 days, subject to cost and institutional approval.

### S3-compatible setup checklist
1. Create a dedicated private bucket and block all public access.
2. Enable versioning and default SSE-KMS encryption; restrict KMS key use to backup and restore roles.
3. Create a write-only backup role scoped to mwecau-guider/daily/* and mwecau-guider/monthly/*; create a separate read role for restore operators.
4. Configure lifecycle rules. For AWS S3, adapt the JSON in this repository to the bucket's actual prefix and apply it with an authorized admin identity.
5. Configure the scheduler (provider cron, GitHub Actions with OIDC, or a protected runner) to invoke the script daily. Never put static cloud credentials in Git.
6. Alert on failed runs, missing daily objects, checksum mismatch, and storage quota/billing anomalies.

Example (only after replacing bucket/prefix and authenticating to the correct cloud account):
aws s3api put-bucket-lifecycle-configuration --bucket YOUR_PRIVATE_BUCKET --lifecycle-configuration file://infra/aws/s3-backup-lifecycle.json

The checked-in script uses S3 server-side AES256 as an additional storage setting. For production, configure bucket default SSE-KMS and verify the bucket policy enforces it. The sample lifecycle file is a template and must be adjusted if the bucket prefix differs.

## 2. Real staging restore drill

Never restore over production. Create an isolated recovery database with the same supported MySQL major/minor version and collation as production.

1. Select a recent encrypted backup and verify its SHA-256 checksum.
2. Retrieve the age identity from the managed secret store into a short-lived protected file (mode 0600).
3. Restore using scripts/restore-mysql.sh with a dedicated staging recovery database and RESTORE_CONFIRM=YES.
4. Verify schema migrations, row counts, foreign keys, account ownership boundaries, transfer debit/credit pairs, idempotency records, audit logs, and ledger balances.
5. Run the Laravel API feature suite against the restored database and perform a staging login/read/write/delete test using synthetic test accounts only.
6. Record backup timestamp, restore start/end, measured RPO/RTO, operator, checksum, and validation results. Destroy the isolated recovery database after approval.

CI currently tests encryption/decryption and guarded restore using fake database clients and a non-production fixture. That is automation, not a live staging restore drill.

## 3. Production secrets, TLS, CORS and cookies

Store these values in the hosting provider's secret manager:
- APP_KEY (generate once with Laravel; never rotate casually because encrypted data/cookies may become unreadable).
- DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD, and provider-required TLS CA/client certificate settings.
- CORS_ALLOWED_ORIGINS with exact HTTPS frontend origins only.
- SANCTUM_STATEFUL_DOMAINS with frontend hostnames and ports only, no scheme.
- SESSION_SECURE_COOKIE=true, SESSION_HTTP_ONLY=true, SESSION_SAME_SITE=lax (or stricter if compatible), and a narrowly scoped cookie domain where applicable.
- SMTP/alert credentials, cloud workload identity, and age restore identity (restore-only access).

Production gate:
- APP_ENV=production, APP_DEBUG=false, APP_URL=https://...
- Use HTTPS end-to-end; enable HSTS at the edge after HTTPS has been verified.
- Reject wildcard CORS origins. Do not combine credentialed CORS with *.
- Configure trusted proxy handling to the actual ingress/load balancer. Do not blindly trust arbitrary forwarded headers.
- Restrict database ingress to the application and backup runner; require TLS database connections where supported.
- Use separate least-privilege app, migration, backup, and restore database users.
- Run bash scripts/validate-production-env.sh in the deployment environment before release. It checks production flags and prints no secret values.

The validator is a preflight check, not a substitute for reviewing the provider's actual TLS, network, cookie, and secret settings.

## 4. Staging browser/device end-to-end QA

A real browser/device run requires a deployed staging frontend and API. Once available:
- Run scripts/staging-smoke.sh with STAGING_WEB_URL, STAGING_API_URL, and STAGING_WEB_ORIGIN set to staging HTTPS URLs.
- Install the PWA on at least one Android device and one desktop browser.
- Test login/logout, expired/revoked session, account/tenant isolation, offline account/transaction view, encrypted pending transaction queue, reconnect, duplicate retry, and no duplicate ledger posting.
- Verify cookies are Secure/HttpOnly and the browser sends only the approved CORS origin.
- Test poor network, app restart while offline, and service-worker update.
- Capture browser console/network errors and sanitized screenshots; never capture real financial or personal data.

The smoke script checks HTTPS endpoints, API health, CORS preflight, and HSTS. It does not replace interactive browser/device testing.

## 5. Load testing

Use staging with synthetic data and dedicated test accounts. Do not run load tests against production or a shared database.

Example:
k6 run -e API_BASE_URL=https://STAGING_API_ORIGIN -e API_TOKEN=SHORT_LIVED_STAGING_TOKEN tests/load/financial-api.js

The checked-in profile is intentionally conservative (up to 3 virtual users). Increase load only after agreeing on a target, confirming rate-limit behavior, and ensuring test data can be discarded. Record p50/p95/p99 latency, request rate, 4xx/5xx, CPU/memory, DB connections, slow queries, and queue depth. Verify rate limits and transaction idempotency under retries.

## 6. Monitoring and alerting

Configure provider-native and application monitoring for:
- API availability and latency (health endpoint plus synthetic authenticated checks).
- 5xx rate, PHP/Laravel exceptions, queue failures, scheduler failures, and database connection saturation.
- Backup success/freshness, checksum verification, cloud upload failures, storage capacity, and PITR availability.
- Authentication anomalies, repeated 401/403/429 responses, and unusual write/transfer volumes.
- TLS certificate expiry, secret rotation dates, and database backup retention.

Route alerts to at least two responsible people/channels. Use a service dashboard and documented on-call contact. Avoid sending tokens, request bodies, financial values, or personal data to logs/alerts.

## 7. Incident response

1. Declare and contain: record incident start, severity, affected services, and incident lead. If compromise is suspected, disable affected credentials and isolate the affected service.
2. Protect financial integrity: pause risky writes or disable the affected integration; preserve database and audit evidence. Do not delete logs or overwrite backups.
3. Assess: determine data exposure, unauthorized access, ledger integrity, backup status, and affected users. Keep an evidence timeline.
4. Recover: restore to an isolated database first, validate financial invariants, rotate compromised secrets, and only then switch traffic under an approved rollback plan.
5. Communicate: notify institutional stakeholders and affected users according to applicable policy and legal obligations. Do not speculate about data exposure.
6. Close: document root cause, impact, recovery time, corrective actions, and owners; schedule a post-incident review.

## 8. Go-live evidence checklist

- [ ] Hosting provider and account owner identified.
- [ ] Managed DB backups/PITR enabled and alerting verified.
- [ ] Encrypted off-provider backup uploaded and retention lifecycle applied.
- [ ] Successful isolated restore drill with measured RPO/RTO.
- [ ] Production secrets stored in secret manager and validated.
- [ ] TLS, trusted proxies, exact CORS, and secure cookies verified on deployed endpoints.
- [ ] Browser and mobile PWA E2E tests passed on staging.
- [ ] Staging load and failure/recovery tests passed.
- [ ] Monitoring and alert delivery verified.
- [ ] Incident-response and rollback owners confirmed.
- [ ] Product/security owner signs release approval.

**Current boundary:** This repository can provide scripts, configuration templates, checks, and a runbook. It cannot enable cloud services, provision real staging infrastructure, install production secrets, or prove real device/load/restore outcomes without access to the selected hosting accounts and deployed staging endpoints.
