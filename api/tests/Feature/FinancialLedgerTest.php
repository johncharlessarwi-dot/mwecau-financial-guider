<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_transaction_only_in_their_own_account(): void
    {
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $owner->id, 'name' => 'Wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '0.00']);

        $token = $owner->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/transactions', [
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => '12500.00',
            'description' => 'Market shopping',
            'occurred_at' => '2026-10-30 09:00:00',
        ])->assertCreated()->assertJsonPath('data.amount', '12500.00');

        $this->assertDatabaseHas('transactions', ['user_id' => $owner->id, 'description' => 'Market shopping']);
    }

    public function test_user_cannot_create_transaction_in_another_users_account(): void
    {
        $owner = User::create(['name' => 'Owner', 'email' => 'owner2@example.com', 'password' => 'a-secure-password']);
        $other = User::create(['name' => 'Other', 'email' => 'other@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $other->id, 'name' => 'Private account', 'type' => 'bank', 'currency' => 'TZS', 'opening_balance' => '0.00']);

        $token = $owner->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/transactions', [
            'account_id' => $account->id,
            'type' => 'income',
            'amount' => '50000.00',
            'description' => 'Unauthorized entry',
            'occurred_at' => '2026-10-30 09:00:00',
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('transactions', ['description' => 'Unauthorized entry']);
    }

    public function test_user_cannot_delete_another_users_transaction(): void
    {
        $owner = User::create(['name' => 'Owner', 'email' => 'owner3@example.com', 'password' => 'a-secure-password']);
        $other = User::create(['name' => 'Other', 'email' => 'other2@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $other->id, 'name' => 'Private', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '0.00']);
        $transaction = Transaction::create([
            'user_id' => $other->id, 'account_id' => $account->id, 'type' => 'expense',
            'amount' => '3000.00', 'currency' => 'TZS', 'category' => 'Other',
            'description' => 'Private transaction', 'occurred_at' => now(), 'status' => 'confirmed',
        ]);

        $token = $owner->createToken('test')->plainTextToken;
        $this->withToken($token)->deleteJson('/api/v1/transactions/'.$transaction->id)->assertNotFound();

        $this->assertDatabaseHas('transactions', ['id' => $transaction->id]);
    }
}