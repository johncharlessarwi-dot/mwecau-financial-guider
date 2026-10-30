<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_zero_or_negative_amounts_are_rejected(): void
    {
        $user = User::create(['name' => 'Ledger User', 'email' => 'ledger@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $user->id, 'name' => 'Wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '0.00']);
        $token = $user->createToken('test')->plainTextToken;

        foreach (['0', '-1'] as $amount) {
            $this->withToken($token)->postJson('/api/v1/transactions', [
                'account_id' => $account->id,
                'type' => 'expense',
                'amount' => $amount,
                'description' => 'Invalid transaction',
                'occurred_at' => '2026-10-30 09:00:00',
            ])->assertUnprocessable()->assertJsonValidationErrors('amount');
        }

        $this->assertDatabaseMissing('transactions', ['description' => 'Invalid transaction']);
    }

    public function test_ledger_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/transactions')->assertUnauthorized();
        $this->postJson('/api/v1/accounts', [
            'name' => 'Private wallet',
            'type' => 'cash',
        ])->assertUnauthorized();
    }
}