<?php

namespace App\Providers;

use App\Models\Account;
use App\Models\Transaction;
use App\Observers\FinancialAuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Account::observe(FinancialAuditObserver::class);
        Transaction::observe(FinancialAuditObserver::class);
    }
}
