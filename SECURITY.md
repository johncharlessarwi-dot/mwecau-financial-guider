# Security and Privacy Baseline

MWECau GUIDER handles highly sensitive personal financial information. Security controls are release requirements, not optional enhancements.

## Identity and access
- Hash passwords with Laravel's supported secure password hashing.
- Use secure, revocable sessions/tokens; rotate and expire credentials appropriately.
- Enforce authorization policies on every API endpoint and object lookup.
- Derive the owner/tenant from the authenticated identity; never trust a client-provided owner ID.
- Apply rate limits to authentication, exports, uploads, AI endpoints, and expensive reports.
- Require additional confirmation for destructive or high-impact actions.

## Financial data protection
- Use decimal database types for monetary values.
- Validate currency, amount, date, account ownership, and transaction state server-side.
- Use database transactions for multi-record ledger operations.
- Use idempotency controls for retries, imports, and recurring jobs.
- Keep an auditable history for sensitive financial mutations.
- Do not expose real balances or transaction details in logs, analytics, URLs, or error messages.

## Files and integrations
- Store receipt attachments privately; authorize every download.
- Validate file size, MIME type, extension, and content; generate server-side filenames.
- Scan uploads where supported and reject executable or unexpected content.
- Keep AI, OCR, speech, FCM, and database credentials on the server in managed secret storage.
- Never commit credentials, access tokens, private keys, or production environment files.
- Do not assume bank or mobile-money APIs, SMS inbox access, or payment execution are available.

## AI and imported content
- Treat AI output, OCR text, voice transcripts, and imported messages as untrusted input.
- Never let AI directly write ledger entries without validation and explicit user confirmation.
- Retrieve financial context only through user-authorized server queries.
- Prevent one user's conversation memory or retrieved records from entering another user's context.
- Mark uncertain extracted fields as uncertain; never fabricate missing values.
- Avoid sending unnecessary personal financial data to external AI providers.

## Privacy and administrator boundaries
- Platform administrators receive operational access, not blanket access to private financial records.
- Collect only data needed for the feature and explain the purpose before requesting permissions.
- Provide data export, account deletion, notification controls, and integration disconnect flows.
- SMS processing, if ever enabled, must be narrowly scoped, consent-based, policy-eligible, and must exclude OTPs, credentials, and unrelated messages.
- Lock-screen notifications must not reveal sensitive financial amounts by default.

## Verification gates
Before production release, test:
- Cross-user IDOR and tenant-isolation scenarios.
- Authentication abuse, token revocation, and rate limits.
- SQL injection, XSS, CSRF where applicable, and unsafe file uploads.
- Duplicate requests, concurrent transfers, and partial failures.
- Backup integrity and a complete restore drill.
- Audit-log access controls and sensitive-data redaction.
- Dependency vulnerabilities and secret scanning.

Report security findings responsibly. Do not use real personal financial data in test fixtures.

---
Designed and developed by **JOHN ONLINE SERVICES AND APPLICATIONS**.  
Developer: **John Charles Sarwi** — https://john-charles-sarwi-portfolio.vercel.app/
