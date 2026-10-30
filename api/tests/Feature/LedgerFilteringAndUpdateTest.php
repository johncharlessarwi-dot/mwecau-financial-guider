<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LedgerFilteringAndUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_filter_their_ledger_by_type_and_date(): void
    {
        $user = User::create(['name' => 'Ledger User', 'email' => 'filter@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $user->id, 'name' => 'Wallet', 'type' => 'cash']);
        $token = $user->createToken('test')->plainTextToken;

        foreach ([
            ['type' => 'income', 'amount' => '5000.00', 'description' => 'Salary', 'occurred_at' => '2026-10-01 09:00:00'],
            ['type' => 'expense', 'amount' => '1200.00', 'description' => 'Transport', 'occurred_at' => '2026-10-10 09:00:00'],
        ] as $row) {
            Transaction::create($row + [
                'user_id' => $user->id,
                'account_id' => $account->id,
                'currency' => 'TZS',
                'category' => 'General',
                'status' => 'confirmed',
            ]);
        }

        $response = $this->withToken($token)->getJson('/api/v1/transactions?type=expense&from=2026-10-05&to=2026-10-31');

        $response->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.description', 'Transport');
    }

    public function test_user_can_update_only_their_own_transaction(): void
    {
        $user = User::create(['name' => 'Owner', 'email' => 'owner@example.com', 'password' => 'a-secure-password']);
        $other = User::create(['name' => 'Other', 'email' => 'other@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $user->id, 'name' => 'Wallet', 'type' => 'cash']);
        $foreignAccount = Account::create(['user_id' => $other->id, 'name' => 'Other wallet', 'type' => 'cash']);
        $transaction = Transaction::create([
            'user_id' => $user->id,
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => '1000.00',
            'currency' => 'TZS',
            'category' => 'Food',
            'description' => 'Lunch',
            'occurred_at' => '2026-10-30 12:00:00',
            'status' => 'confirmed',
        ]);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->patchJson('/api/v1/transactions/'.$transaction->id, [
            'amount' => '1500.00',
            'description' => 'Updated lunch',
        ])->assertOk()->assertJsonPath('data.amount', '1500.00');

        $this->withToken($token)->patchJson('/api/v1/transactions/'.$transaction->id, [
            'account_id' => $foreignAccount->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('account_id');

        $foreignTransaction = Transaction::create([
            'user_id' => $other->id,
            'account_id' => $foreignAccount->id,
            'type' => 'income',
            'amount' => '900.00',
            'currency' => 'TZS',
            'category' => 'Other',
            'description' => 'Private',
            'occurred_at' => '2026-10-30 12:00:00',
            'status' => 'confirmed',
        ]);

        $this->withToken($token)->patchJson('/api/v1/transactions/'.$foreignTransaction->id, [
            'description' => 'Intrusion',
        ])->assertNotFound();
    }
}
