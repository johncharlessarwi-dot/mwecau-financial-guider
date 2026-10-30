# MWECau GUIDER — Implementation Roadmap

Delivery is organized into independently committed subfeatures. Each batch must pass its applicable automated checks and smoke tests before deployment. A planned item is not a completed feature.

## Batch 0 — Repository and engineering foundation
- [x] Initialize product README and developer credit
- [x] Record architecture and financial invariants
- [ ] Add client/backend workspace scaffolding
- [ ] Add formatting, linting, static analysis, and CI
- [ ] Add environment templates with placeholders only
- [ ] Add health-check and deployment documentation

## Batch 1 — Identity and tenant boundaries
- [ ] Registration, login, logout, password reset
- [ ] Profile and account lifecycle
- [ ] Token/session lifecycle and rate limiting
- [ ] Ownership policies and cross-user access tests
- [ ] Account export and deletion workflow

## Batch 2 — Financial ledger foundation
- [ ] Financial accounts and opening balances
- [ ] Categories
- [ ] Income and expense entries
- [ ] Decimal-safe balance calculations
- [ ] Atomic internal transfers and idempotency
- [ ] Transaction history, filters, and pagination

## Batch 3 — Planning and obligations
- [ ] Monthly and category budgets with configurable alerts
- [ ] Savings goals and transfer-aware contributions
- [ ] Borrowed/lent debt records and repayment history
- [ ] Bills, recurring schedules, and payment confirmation

## Batch 4 — Dashboard and reporting
- [ ] Recorded balance and cash-flow summaries
- [ ] Daily, weekly, monthly, yearly filters
- [ ] Category and trend analytics
- [ ] Budget, savings, and debt reports
- [ ] PDF and spreadsheet export

## Batch 5 — AI personal accountant
- [ ] Provider-independent server-side AI adapter
- [ ] Authorized financial context retrieval
- [ ] Kiswahili and English chat
- [ ] Explainable insights and recommendations
- [ ] Transaction draft, validation, confirmation, and audit trail
- [ ] Per-user conversation history and deletion controls

## Batch 6 — Capture and automation
- [ ] Voice capture and visible transcription review
- [ ] Receipt upload, OCR, confidence markers, and duplicate warnings
- [ ] SMS import review workflow only after Android/Google Play policy eligibility
- [ ] Reminders, notification preferences, and quiet hours
- [ ] Offline drafts and safe background synchronization

## Batch 7 — Web and Android clients
- [ ] Responsive React dashboard
- [ ] Flutter Android application
- [ ] Secure authentication and API integration
- [ ] Offline-first draft queue and conflict handling
- [ ] Device testing and Android build pipeline

## Batch 8 — SaaS operations and production readiness
- [ ] Subscription plans and entitlement enforcement
- [ ] Privacy-preserving admin dashboard
- [ ] Audit events and security monitoring
- [ ] Backup restore drills and retention policy
- [ ] Load, authorization, and failure-recovery tests
- [ ] Production deployment and operational runbooks

## Definition of done for each subfeature

1. Scope is narrow and independently reviewable.
2. Implementation and migration are committed separately where practical.
3. Unit, integration, authorization, and regression tests cover the changed behavior.
4. Lint/static checks pass; failures are fixed or explicitly documented.
5. No secrets, real personal financial data, or unsafe sample credentials are committed.
6. Documentation and developer credit are maintained.
7. Deployment is performed only after the batch is verified; health checks and smoke tests are recorded.

## Deployment constraint

AppDeploy deployment is subject to the account's available deployment credits. If a deployment window is paused, continue safe repository work and resume deployment only after the service reports availability. Do not claim a deployment succeeded without a returned deployment result and a successful health check.

## Developer credit

Designed and developed by **JOHN ONLINE SERVICES AND APPLICATIONS**.  
Developer: **John Charles Sarwi** — https://john-charles-sarwi-portfolio.vercel.app/
