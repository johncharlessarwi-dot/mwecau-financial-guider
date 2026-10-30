# MWECau GUIDER

**Your Money. Your Decisions. Your Future.**

MWECau GUIDER is an AI-powered personal accounting and financial management platform designed for individuals in Tanzania. It helps people record income and expenses, manage accounts, plan budgets, track savings and debts, and understand their financial position using clear, explainable insights.

## Product direction

- Android application (Flutter) and responsive web dashboard (React)
- Versioned REST API (Laravel) with MySQL persistence
- Tanzanian Shillings (TZS) as the default currency
- English and Kiswahili experiences
- User-isolated financial records and privacy-first administration
- AI assistance grounded in authorized, recorded financial data
- Confirmation-first workflows for AI, receipt OCR, voice, and permitted SMS imports
- SaaS-ready foundation with subscriptions and platform administration

## Current development status

This repository is being initialized from the approved product specification. Features will be delivered in small, independently committed subfeatures and deployed in verified batches. A feature is not considered complete until its implementation, tests, security checks, and deployment status have been reviewed.

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)
- [Security and privacy principles](SECURITY.md)

## Important financial-data principles

1. Financial amounts use decimal-safe storage and calculations; never binary floating-point for persisted money.
2. Every tenant-owned record is scoped to its authenticated owner.
3. Transfers are not income or expenses and must balance as paired ledger movements.
4. Debt receipts, repayments, savings movements, and recurring entries require explicit accounting treatment to avoid double counting.
5. AI must retrieve authorized records for data-dependent answers and must never invent balances or transactions.
6. AI-generated or imported transactions remain drafts until the user confirms them.
7. External bank and mobile-money access is not assumed. Integrations require legitimate APIs, permission, and provider authorization.
8. Platform administrators do not receive unrestricted access to private financial records.

## Developer credit

**Designed and developed by JOHN ONLINE SERVICES AND APPLICATIONS.**  
Developer: **John Charles Sarwi**  
Portfolio: https://john-charles-sarwi-portfolio.vercel.app/  
GitHub: https://github.com/johncharlessarwi-dot

---

This project is under active development. Production financial use must wait until the relevant security, accounting, backup, and recovery controls have passed verification.
