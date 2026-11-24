> **Hosting update (November 2026):** This document covers an optional migration to Cloudflare **Pages**. The current frontend hostname is `https://mwecau-financial-guider.johncharlessarwi.workers.dev/`; for current registration/API deployment guidance see [Cloudflare Workers API setup](CLOUDFLARE_WORKERS_API_SETUP.md). Do not use this document's pages.dev URLs for the current site's Search Console property.

# Cloudflare Pages — MWECau Financial Guider

This document describes deployment of the **React/Vite frontend only**. Cloudflare Pages does not execute this repository's Laravel PHP API or host its MySQL database.

## 1. Create the Pages project (account owner action)

1. Open https://dash.cloudflare.com/ and sign in to the intended Cloudflare account.
2. Go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Authorize GitHub and select `johncharlessarwi-dot/mwecau-financial-guider`. Grant access to this repository only where available.
4. Select the production branch `main`.
5. Choose project name `mwecau-financial-guider` **if available**, yielding `https://mwecau-financial-guider.pages.dev/`.
6. Build settings:
   - Framework preset: **React (Vite)** or **None**.
   - Root directory: repository root (`/`).
   - Build command: `npm run build && node scripts/verify-cloudflare-build.mjs`
   - Build output directory: `dist`
   - Node version: **22** (`.node-version` is included in the repository).
   - `VITE_BASE_PATH`: leave unset, or explicitly `/`. Unlike GitHub Pages, Cloudflare serves this project from the site root.
   - `VITE_API_URL`: configure **only after** the Laravel API has been provisioned on an actual HTTPS origin. This variable is public in bundled frontend assets; never store secrets here.
7. Click **Save and Deploy** and check the actual build logs, production URL, and deployed commit.

**If the preferred project name is unavailable:** choose an available name and update `index.html`, `public/robots.txt`, `public/sitemap.xml`, and `scripts/verify-cloudflare-build.mjs` to the actual Cloudflare production URL before indexing. Never submit a sitemap for a hostname you do not control.

Cloudflare Git integration automatically deploys new commits pushed to `main`. Preview branches can be validated before merge. Avoid publishing real financial records in a preview build.

## 2. Verify the live frontend

1. Visit the actual production URL over HTTPS; verify a successful page load.
2. Check `/manifest.webmanifest`, `/sw.js`, `/robots.txt`, `/sitemap.xml`, and `/icons/guider-icon.svg` return the intended content (not the SPA HTML).
3. Confirm browser console has no missing assets, JavaScript exceptions, or service-worker errors.
4. Verify the installable PWA and offline app-shell on a test Android browser and desktop browser; **offline editing and financial synchronization are not proven by this step**.
5. Confirm the HTTP response has basic security headers from `public/_headers`.
6. Run the GitHub CI checks. CI artifact validation is useful, but not a substitute for this live-host verification.

## 3. Google Search Console indexing

1. In Search Console, create a **URL-prefix** property with the **actual** production URL, including `https://`.
2. The HTML verification tag is already present in `index.html`. Click **Verify** only when the deployed HTML contains the tag.
3. Submit `https://<actual-pages-host>/sitemap.xml` via **Indexing → Sitemaps**.
4. Run **URL Inspection** on the homepage and request indexing when the property is verified.
5. Check that the canonical tag, Open Graph URL, sitemap and robots.txt all reference the same host. Indexing and ranking are controlled by Google and cannot be guaranteed.

## 4. Laravel backend is a separate release gate

This repo uses a Laravel API and MySQL database. A static frontend deployment alone does not make registration, login, transactions, reports or budgets functional.

Before financial data is accepted from real users:
- Provision the Laravel backend and MySQL using compatible managed hosting.
- Set production app/database secrets in the backend hosting provider's secret manager; do not commit them.
- Configure the actual HTTPS frontend origin in `CORS_ALLOWED_ORIGINS` and appropriate Sanctum stateful domains.
- **Cross-site authentication caveat:** `pages.dev` and an unrelated API host are different sites; default Sanctum first-party session cookies may be blocked in browsers. Plan same-site routing or a carefully tested secure deployment topology rather than disabling cookie security.
- Carry out real encrypted backup recovery, live TLS/cookie/CORS verification, monitoring and staging QA using `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`.

**Release status:** frontend hosting configuration is prepared; Cloudflare account connection and live production deployment are not confirmed by repository changes alone.
