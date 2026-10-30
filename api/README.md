# MWECau GUIDER API

Laravel 12 REST API for the MWECau GUIDER personal finance platform.

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
- `GET|POST /accounts` — list and create owned accounts; account listing includes a calculated `current_balance`
- `GET|POST /transactions` — list and create owned ledger entries
- `PATCH /transactions/{id}` — update an owned ledger entry
- `DELETE /transactions/{id}` — delete an owned entry
- `POST /transfers` — atomically record a same-currency transfer between two owned accounts

Authenticated endpoints require `Authorization: Bearer <token>`.

## Financial and security constraints

- Persisted money uses SQL DECIMAL, not floating-point columns.
- Account and transaction queries are scoped to the authenticated user.
- A transaction cannot be attached to another user's account, including during updates.
- Transfers create linked debit and credit entries under one database transaction; both accounts must belong to the authenticated user and use the same currency.
- Account balances are calculated from opening balances and confirmed ledger entries; transfers are represented by paired entries so they do not change the user's total wealth.
- Registration and login are rate-limited.
- Never commit `.env`, credentials, production keys, or real financial records.
- Reconciliation, immutable audit history, and accounting-period controls remain planned work.

## Tests

Run `composer test`. Tests use an in-memory SQLite database and cover health, authentication, token revocation, and cross-user financial-data isolation.

## Developer credit

Designed and developed by **JOHN ONLINE SERVICES AND APPLICATIONS**.  
Developer: **John Charles Sarwi**  
Portfolio: https://john-charles-sarwi-portfolio.vercel.app/