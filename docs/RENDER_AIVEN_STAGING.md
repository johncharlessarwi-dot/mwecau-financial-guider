# Render + Aiven: staging setup

This is a staging-only guide. Do not enable financial accounts for real users before end-to-end security testing and backup recovery.

## Aiven
- Wait for **Running**, then inspect **Change plan**.
- The Developer tier shown by the owner is not Free; Free is limited to 1 GB storage.
- Review billing and downgrade to **Free**, if offered. No real data has been added yet.
- Keep Aiven login details and database password in the provider dashboard.
- MySQL connection uses Aiven host, port, database name, user, password and TLS CA certificate.

## Render: Laravel Docker API
- Open https://dashboard.render.com and choose **New → Web Service**.
- Connect GitHub repository `johncharlessarwi-dot/mwecau-financial-guider`.
- Name: `mwecau-guider-api-staging`.
- Branch: `main`. Root directory: `api`.
- Environment/runtime: **Docker**; Dockerfile `./Dockerfile` in the selected root.
- Instance: Free, if available, for staging only.
- The image uses PHP 8.3 and Apache listening on Render's `PORT`.

## Environment configuration in Render
| Name | Value |
| --- | --- |
| APP_NAME | MWECau GUIDER API |
| APP_ENV | production |
| APP_DEBUG | false |
| APP_URL | Actual https Render backend URL |
| APP_KEY | Unique Laravel-generated encryption key; keep private |
| DB_CONNECTION | mysql |
| DB_HOST | Aiven hostname |
| DB_PORT | Aiven port |
| DB_DATABASE | Aiven database name |
| DB_USERNAME | Restricted database user |
| DB_PASSWORD | Secret from Aiven, set only in Render |
| DB_SSL_CA_PEM | Full public Aiven CA certificate text |
| LOG_CHANNEL | stderr |
| SESSION_DRIVER | database |
| SESSION_ENCRYPT | true |
| SESSION_SECURE_COOKIE | true |
| SESSION_HTTP_ONLY | true |
| SESSION_SAME_SITE | lax, only with verified same-site routing |
| CACHE_STORE | database |
| QUEUE_CONNECTION | sync for initial staging |
| CORS_ALLOWED_ORIGINS | Exact Cloudflare Workers frontend HTTPS origin |
| RUN_MIGRATIONS | true for first controlled staging start; false afterward |

Generate APP_KEY locally using Laravel: `php artisan key:generate --show`. Never paste it into a chat, commit it or use the CI testing key.

After deployment, browse `https://YOUR_ACTUAL_RENDER_HOST/api/v1/health` and verify JSON status `ok`. This checks service availability only; it does not prove registration or financial integrity.

**Important:** Workers domain and Render domain are cross-site. Laravel Sanctum may not maintain session cookies reliably across them. A secure same-origin Worker proxy or owned same-site domains must be implemented and tested before enabling public registration. Do not disable CSRF or cookie security to work around this.

See also `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`.
