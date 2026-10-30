<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountTransferTest extends TestCase
{
    use RefreshDatabase;

    public function test_transfer_creates_balanced_linked_ledger_entries_atomically(): void
    {
        $user = User::create(['name' => 'Transfer User', 'email' => 'transfer@example.com', 'password' => 'a-secure-password']);
        $wallet = Account::create(['user_id' => $user->id, 'name' => 'Wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '100000.00']);
        $bank = Account::create(['user_id' => $user->id, 'name' => 'Bank', 'type' => 'bank', 'currency' => 'TZS', 'opening_balance' => '0.00']);
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/transfers', [
            'from_account_id' => $wallet->id,
            'to_account_id' => $bank->id,
            'amount' => '25000.00',
            'description' => 'Move savings',
            'occurred_at' => '2026-10-30 10:00:00',
        ]);

        $response->assertCreated()
            ->assertJsonPath('message', 'Transfer recorded.')
            ->assertJsonCount(2, 'data');

        $reference = $response->json('transfer_reference');
        $this->assertNotEmpty($reference);
        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseHas('transactions', [
            'account_id' => $wallet->id,
            'type' => 'expense',
            'amount' => '25000.00',
            'transfer_reference' => $reference,
        ]);
        $this->assertDatabaseHas('transactions', [
            'account_id' => $bank->id,
            'type' => 'income',
            'amount' => '25000.00',
            'transfer_reference' => $reference,
        ]);
    }

    public function test_transfer_rejects_different_currencies_and_foreign_accounts(): void
    {
        $user = User::create(['name' => 'Transfer User', 'email' => 'transfer-rules@example.com', 'password' => 'a-secure-password']);
        $other = User::create(['name' => 'Other User', 'email' => 'transfer-other@example.com', 'password' => 'a-secure-password']);
        $tzs = Account::create(['user_id' => $user->id, 'name' => 'TZS', 'type' => 'cash', 'currency' => 'TZS']);
        $usd = Account::create(['user_id' => $user->id, 'name' => 'USD', 'type' => 'bank', 'currency' => 'USD']);
        $foreign = Account::create(['user_id' => $other->id, 'name' => 'Foreign', 'type' => 'cash', 'currency' => 'TZS']);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/transfers', [
            'from_account_id' => $tzs->id,
            'to_account_id' => $usd->id,
            'amount' => '1000',
        ])->assertUnprocessable()->assertJsonValidationErrors('to_account_id');

        $this->withToken($token)->postJson('/api/v1/transfers', [
            'from_account_id' => $tzs->id,
            'to_account_id' => $foreign->id,
            'amount' => '1000',
        ])->assertUnprocessable()->assertJsonValidationErrors('to_account_id');

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_account_list_includes_current_balance_from_confirmed_ledger_entries(): void
    {
        $user = User::create(['name' => 'Balance User', 'email' => 'balance@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $user->id, 'name' => 'Cash', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '10000.00']);
        Transaction::create([
            'user_id' => $user->id,
            'account_id' => $account->id,
            'type' => 'income',
            'amount' => '5000.00',
            'currency' => 'TZS',
            'category' => 'Salary',
            'description' => 'Income',
            'occurred_at' => '2026-10-30 08:00:00',
            'status' => 'confirmed',
        ]);
        Transaction::create([
            'user_id' => $user->id,
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => '2000.00',
            'currency' => 'TZS',
            'category' => 'Food',
            'description' => 'Expense',
            'occurred_at' => '2026-10-30 09:00:00',
            'status' => 'confirmed',
        ]);
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/accounts')->assertOk();
        $this->assertEquals(13000, (float) $response->json('data.0.current_balance'));
    }
}
