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


## Cloudflare Workers frontend hosting

The public React/PWA frontend is hosted by the project owner at
**https://mwecau-financial-guider.johncharlessarwi.workers.dev/** (live endpoint availability must be checked separately).
It is hosted using Cloudflare Workers static assets, not a Laravel web server. SEO canonical URL, sitemap and Google Search Console verification meta tag target this Workers hostname.

**Important:** Until a real HTTPS Laravel API is connected at build time with `VITE_API_URL`, sign-in and registration are deliberately disabled. The frontend never sends user credentials to localhost in production. Adding a Cloudflare runtime variable without rebuilding the Vite assets does not supply `import.meta.env.VITE_API_URL` to the compiled JavaScript.

See [Cloudflare Workers and backend connection guide](docs/CLOUDFLARE_WORKERS_API_SETUP.md). The old [Pages setup guide](docs/CLOUDFLARE_PAGES_DEPLOYMENT.md) is retained only for teams that later choose to migrate to `pages.dev`; it is not the current production host.

**Deployment warning:** A live Worker frontend alone is not a functioning financial SaaS. Laravel API/MySQL hosting, session cookie topology, backups, staging QA and monitoring must still be verified before accepting actual user financial information.

## Backend staging (Render + Aiven)

A Render-compatible PHP 8.3 Docker image, startup script, container smoke test, and a provider setup guide are available under `api/` and [Render + Aiven staging instructions](docs/RENDER_AIVEN_STAGING.md).

**Do not enable live financial registrations** until the Laravel API and MySQL are actually deployed, the Cloudflare/Render same-origin authentication topology is verified, and backup/restore tests have passed. Cloudflare Workers currently hosts the frontend only.

## Local development: authenticated SPA

The web client uses Laravel Sanctum's stateful, cookie-based SPA authentication. It does not persist bearer tokens in local storage.

1. Start the Laravel API from `api/` and configure its database and application key.
2. Set `SANCTUM_STATEFUL_DOMAINS` to the frontend hostname and port (without a scheme), for example `localhost:5173,127.0.0.1:5173`.
3. Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin, for example `http://localhost:5173`. Credential support is enabled only for these configured origins.
4. Copy the root `.env.example` to `.env` and set `VITE_API_URL` to the API origin, for example `http://localhost:8000`.
5. Start the Vite client with `npm install && npm run dev`.

The browser first obtains the Sanctum CSRF cookie, then sends credentialed requests. The API regenerates the session identifier after registration and login, exposes only a safe user profile, and invalidates the session on logout. Login and registration remain rate-limited.

For production, serve the frontend and API over HTTPS, set `SESSION_SECURE_COOKIE=true`, use a same-site deployment topology where possible, and configure the cookie domain and Sanctum stateful domains for the actual hostnames. Do not use wildcard CORS origins with credentials. The authenticated web workspace reads and writes accounts, transactions, categories, and budgets through the versioned Laravel API. Account balances are calculated from confirmed ledger entries in the account currency. The Reports workspace now provides authenticated, date-filtered income, expense, net cash-flow, and category summaries, with TZS and USD kept separate; transfers and draft entries are excluded. The transaction list currently loads the latest 100 records; full pagination, trend charts, exports, and financial health scoring remain planned. The dashboard does not seed or display fabricated demo financial records. The AI Accountant remains not yet connected.

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
