# MWECau GUIDER API

Laravel 11 REST API for the MWECau GUIDER personal finance platform.

## Requirements

- PHP 8.2+
- Composer 2
- MySQL 8+ for production (SQLite is used by automated tests)

## Local setup

1. Run `composer install` inside this directory.
2. Copy `.env.example` to `.env` and configure a local database.
3. Run `php artisan key:generate`.
4. Run `php artisan migrate`.
5. Start with `php artisan serve`.

## API baseline

All endpoints are versioned under `/api/v1`.

- `GET /health` — service health
- `POST /auth/register` — create account and issue Sanctum token
- `POST /auth/login` — authenticate and issue token
- `POST /auth/logout` — revoke current token
- `GET|POST /accounts` — list and create owned accounts
- `GET|POST /transactions` — list and create owned ledger entries
- `DELETE /transactions/{id}` — delete an owned entry

Authenticated endpoints require `Authorization: Bearer <token>`.

## Financial and security constraints

- Persisted money uses SQL DECIMAL, not floating-point columns.
- Account and transaction queries are scoped to the authenticated user.
- A transaction cannot be attached to another user's account.
- Registration and login are rate-limited.
- Never commit `.env`, credentials, production keys, or real financial records.
- This initial ledger supports income and expense only. Transfers, reconciliation, immutable audit history, and accounting-period controls are separate planned phases.

## Tests

Run `composer test`. Tests use an in-memory SQLite database and cover health, authentication, token revocation, and cross-user financial-data isolation.

## Developer credit

Designed and developed by **JOHN ONLINE SERVICES AND APPLICATIONS**.  
Developer: **John Charles Sarwi**  
Portfolio: https://john-charles-sarwi-portfolio.vercel.app/