# MWECau GUIDER — Architecture Baseline

## 1. Target architecture

The product is API-first and separates clients from the financial domain:

- **Android:** Flutter application; local drafts and an encrypted synchronization queue.
- **Web:** React dashboard consuming the same versioned API.
- **Backend:** PHP Laravel REST API under `/api/v1`.
- **Database:** MySQL with foreign keys, indexes, decimal monetary columns, and transaction-safe writes.
- **Authentication:** Laravel Sanctum with secure session/token lifecycle.
- **AI:** Provider-independent server-side adapter; secrets never reach clients.
- **Notifications:** Firebase Cloud Messaging where configured.
- **Files:** Private object storage for receipts and attachments, served through authorized access.
- **Operations:** Centralized logs, audit events, health checks, backups, and restore procedures.

The repository may contain client and backend workspaces, but domain rules must remain server-authoritative.

## 2. Suggested repository layout

```
android/                 Flutter client
web/                     React dashboard
backend/                 Laravel API
docs/                    Product, architecture, ADRs, runbooks
.github/workflows/        CI and quality checks
```

## 3. Core backend modules

1. Identity and profile
2. Financial accounts
3. Ledger and transactions
4. Categories
5. Budgets
6. Savings goals and contributions
7. Debts and repayments
8. Bills and recurring rules
9. Receipts and attachments
10. AI assistant and transaction drafts
11. Voice transcription integration
12. SMS import review queue (only if policy-eligible)
13. Notifications and reminders
14. Reports and exports
15. Subscription and SaaS administration
16. Audit, monitoring, backup, and recovery

## 4. Accounting invariants

- Persist money as `DECIMAL` (never float/double).
- Every transaction belongs to an authenticated user and, where relevant, an owned account.
- Transfers create linked debit and credit movements in one database transaction; they are excluded from income and expense totals.
- A transfer cannot debit and credit the same account.
- Balance changes and ledger entries commit atomically.
- Savings contributions sourced from another owned account are transfers, not new expenses.
- Debt principal and repayments are tracked separately from ordinary income/expense reporting.
- Reversals/corrections use auditable compensating entries rather than silent history mutation.
- Idempotency keys protect retryable create/import operations from duplicates.

## 5. Tenant isolation and administration

All tenant-owned queries must be scoped on the server using the authenticated principal. Client-supplied owner IDs are never trusted. Authorization policies must be enforced on every read and write. SaaS administrators may access operational metadata and security events, but not unrestricted private financial records.

## 6. AI safety boundary

AI is an assistant, not the system of record. Data-dependent answers must be assembled from authorized backend queries. Transaction intent produces a validated draft with amount, type, category, account, and date confidence. Ambiguous drafts require clarification; all drafts require explicit confirmation before persistence. Recommendations must label facts, calculations, estimates, and advice distinctly.

## 7. External integrations

Bank/mobile-money access, automatic payments, SMS inbox reading, OCR, speech recognition, AI providers, and push delivery are optional adapters. They remain disabled until credentials, user consent, provider authorization, platform policy, and operational controls are verified. Manual entry and share/import flows remain available fallbacks.

## 8. Environments and deployment

Use separate development, preview/staging, and production environments. Secrets belong in managed secret storage, never source control. Deploy in small batches after CI, migration review, security checks, and smoke tests. Database migrations must be backward-compatible where possible and include a rollback/recovery plan.

## 9. Developer credit

Designed and developed by **JOHN ONLINE SERVICES AND APPLICATIONS**.  
Developer: **John Charles Sarwi** — https://john-charles-sarwi-portfolio.vercel.app/
