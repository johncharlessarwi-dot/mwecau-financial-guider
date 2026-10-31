<?php

namespace Tests\Feature;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinancialReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_summarizes_confirmed_non_transfer_entries_by_currency_and_category(): void
    {
        $user = User::factory()->create();
        $account = $user->accounts()->create(['name' => 'TZS wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => 0]);
        $usdAccount = $user->accounts()->create(['name' => 'USD wallet', 'type' => 'bank', 'currency' => 'USD', 'opening_balance' => 0]);
        $other = User::factory()->create();
        $otherAccount = $other->accounts()->create(['name' => 'Private wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => 0]);

        $base = ['user_id' => $user->id, 'account_id' => $account->id, 'currency' => 'TZS', 'status' => 'confirmed', 'occurred_at' => '2026-10-15 10:00:00'];
        Transaction::create(array_merge($base, ['type' => 'income', 'amount' => '100000.00', 'category' => 'Salary', 'description' => 'Salary']));
        Transaction::create(array_merge($base, ['type' => 'expense', 'amount' => '25000.00', 'category' => 'Food', 'description' => 'Groceries']));
        Transaction::create(array_merge($base, ['type' => 'expense', 'amount' => '70000.00', 'category' => 'Transfer', 'description' => 'Transfer leg', 'transfer_reference' => '550e8400-e29b-41d4-a716-446655440000']));
        Transaction::create(array_merge($base, ['type' => 'expense', 'amount' => '90000.00', 'category' => 'Shopping', 'description' => 'Pending purchase', 'status' => 'pending']));
        Transaction::create(array_merge($base, ['type' => 'expense', 'amount' => '50000.00', 'category' => 'Transport', 'description' => 'Outside range', 'occurred_at' => '2026-09-30 10:00:00']));
        Transaction::create(['user_id' => $user->id, 'account_id' => $usdAccount->id, 'type' => 'income', 'amount' => '50.25', 'currency' => 'USD', 'category' => 'Freelance', 'description' => 'USD work', 'occurred_at' => '2026-10-16 10:00:00', 'status' => 'confirmed']);
        Transaction::create(['user_id' => $other->id, 'account_id' => $otherAccount->id, 'type' => 'income', 'amount' => '999999.00', 'currency' => 'TZS', 'category' => 'Salary', 'description' => 'Foreign tenant', 'occurred_at' => '2026-10-15 10:00:00', 'status' => 'confirmed']);

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')
            ->assertOk()
            ->assertJsonPath('data.from', '2026-10-01')
            ->assertJsonPath('data.currencies.0.currency', 'TZS')
            ->assertJsonPath('data.currencies.0.income', '100000.00')
            ->assertJsonPath('data.currencies.0.expenses', '25000.00')
            ->assertJsonPath('data.currencies.0.net_cash_flow', '75000.00')
            ->assertJsonPath('data.currencies.0.categories.0.category', 'Food')
            ->assertJsonPath('data.currencies.1.currency', 'USD')
            ->assertJsonPath('data.currencies.1.income', '50.25');
    }

    public function test_report_requires_authentication_and_rejects_invalid_ranges(): void
    {
        $this->getJson('/api/v1/reports/summary')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/reports/summary?from=2026-11-01&to=2026-10-01')
            ->assertUnprocessable()->assertJsonValidationErrors('to');
        $this->getJson('/api/v1/reports/summary?from=2025-01-01&to=2026-10-31')
            ->assertUnprocessable()->assertJsonValidationErrors('to');
        $this->getJson('/api/v1/reports/summary?currency=EUR')
            ->assertUnprocessable()->assertJsonValidationErrors('currency');
    }

    public function test_report_can_be_filtered_to_a_single_currency(): void
    {
        $user = User::factory()->create();
        $account = $user->accounts()->create(['name' => 'Wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => 0]);
        Transaction::create(['user_id' => $user->id, 'account_id' => $account->id, 'type' => 'income', 'amount' => '1200.00', 'currency' => 'TZS', 'category' => 'Salary', 'description' => 'Salary', 'occurred_at' => '2026-10-10 10:00:00', 'status' => 'confirmed']);

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/reports/summary?currency=TZS')
            ->assertOk()
            ->assertJsonCount(1, 'data.currencies')
            ->assertJsonPath('data.currencies.0.income', '1200.00');
    }
}
