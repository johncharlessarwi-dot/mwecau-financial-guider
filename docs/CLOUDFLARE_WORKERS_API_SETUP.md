# Cloudflare Workers frontend: registration/API troubleshooting

## Actual frontend URL

https://mwecau-financial-guider.johncharlessarwi.workers.dev/

This is the **Cloudflare Workers** hostname currently selected by the project owner. It is not a `*.pages.dev` Cloudflare Pages site. The frontend may be served using Workers Static Assets.

## Why "Failed to fetch" occurred

The original `src/auth/AuthGate.tsx` used a second, direct `fetch()` implementation and defaulted to `http://localhost:8000` if `VITE_API_URL` was missing. In a production browser, `localhost` points to the **visitor's own computer**, and a page served over HTTPS cannot safely connect to that HTTP endpoint.

The frontend now shares the audited API client and **does not attempt to register or sign in** when no valid HTTPS backend origin was bundled into the app. It displays a clear notice until the API is connected. This is a safety fix, not a substitute for backend hosting.

## To activate real accounts

1. Provision a Laravel PHP 8.3+ hosting service and a supported managed MySQL database. Cloudflare Workers static assets **do not run the PHP application** in `api/`.
2. Configure the Laravel app with managed secrets and production settings; run migrations in the intended database; set up secure sessions and production backup/recovery according to `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`.
3. Test the backend **HTTPS** endpoint `https://YOUR_ACTUAL_API_HOST/api/v1/health`. Expected JSON has `"status":"ok"`. Never enter a fake API URL just to make the frontend build green.
4. Set `VITE_API_URL=https://YOUR_ACTUAL_API_HOST` as a **build-time** frontend environment variable in the Cloudflare Workers build configuration. Use the API's origin only (no `/api/v1` suffix, paths, queries, tokens or trailing credentials).
5. Trigger a **new build and deployment** of the Vite frontend. Cloudflare Worker runtime secrets are **not** automatically compiled into a Vite `import.meta.env.VITE_API_URL` build variable. Client-side `VITE_` variables are public, so never put DB credentials, tokens or application secrets in them.
6. Configure Laravel's `CORS_ALLOWED_ORIGINS` to exactly `https://mwecau-financial-guider.johncharlessarwi.workers.dev`; add the appropriate frontend hostname to `SANCTUM_STATEFUL_DOMAINS` (without scheme), if using Sanctum stateful SPA authentication.
7. **Critical cookie requirement:** the `workers.dev` frontend and a separate API provider's domain are different sites. Laravel Sanctum session cookies may not work across these sites, even with CORS headers, because browsers can block third-party cookies. Prefer a secure **same-origin API reverse proxy**, or move the frontend and backend under an owned same-site domain; test HTTPS, CSRF, session handling and browser cookie policy before activating registration. Do not disable CSRF, use a wildcard credentialed CORS origin or store sensitive bearer tokens in localStorage to work around this.
8. On a staging deployment with synthetic test identities, run: register, login, CSRF check, session refresh, logout, account isolation, secure cookie checks, and failure/retry behavior. Enable real accounts only after these and production recovery requirements pass.

## Check in browser developer tools

- **No network request, disabled form:** no valid production `VITE_API_URL` is configured. This is expected until API provisioning.
- **Request to `http://localhost:8000`:** browser is running an old frontend build or a different deployment. Rebuild from updated `main` and refresh service worker/cache.
- **CORS error:** check the API service is accessible and the exact CORS configuration.
- **404/HTML instead of JSON:** frontend is contacting a static site or the wrong backend path.
- **401:** session missing or expired. **419:** CSRF/session-cookie mismatch.
- **5xx/timeout:** diagnose Laravel or DB hosting; never report successful account creation without a server response.

## Google indexing

The canonical URL, Open Graph URL, robots.txt and sitemap must all use this Workers hostname. After a successful frontend deploy, inspect:
- `/robots.txt`
- `/sitemap.xml`
- The canonical link and HTML verification tag in page source.

Verify the **URL-prefix** property in Google Search Console for the exact `workers.dev` origin. Google can index public site content, but indexing and ranking are not guaranteed.

Do not treat frontend deploy/SEO readiness as proof that the account and financial APIs are ready.
