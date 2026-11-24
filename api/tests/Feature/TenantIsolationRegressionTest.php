<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_cannot_read_or_mutate_another_users_transaction(): void
    {
        $owner = User::create(['name' => 'Ledger Owner', 'email' => 'ledger-owner@example.com', 'password' => 'a-secure-password']);
        $intruder = User::create(['name' => 'Other User', 'email' => 'other-user@example.com', 'password' => 'a-secure-password']);
        $account = Account::create(['user_id' => $owner->id, 'name' => 'Private Wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '10000.00']);
        $transaction = Transaction::create([
            'user_id' => $owner->id,
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => '2500.00',
            'currency' => 'TZS',
            'category' => 'Food',
            'description' => 'Private owner transaction',
            'occurred_at' => '2026-10-31 09:00:00',
            'status' => 'confirmed',
        ]);
        $token = $intruder->createToken('tenant-isolation-test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/transactions')
            ->assertOk()
            ->assertJsonMissing(['description' => 'Private owner transaction']);

        $this->withToken($token)->patchJson('/api/v1/transactions/'.$transaction->id, [
            'description' => 'Unauthorized modification',
        ])->assertNotFound();

        $this->withToken($token)->deleteJson('/api/v1/transactions/'.$transaction->id)
            ->assertNotFound();

        $this->assertDatabaseHas('transactions', [
            'id' => $transaction->id,
            'description' => 'Private owner transaction',
            'user_id' => $owner->id,
        ]);
    }

    public function test_user_cannot_create_transaction_against_another_users_account(): void
    {
        $owner = User::create(['name' => 'Account Owner', 'email' => 'account-owner@example.com', 'password' => 'a-secure-password']);
        $other = User::create(['name' => 'Account Visitor', 'email' => 'account-visitor@example.com', 'password' => 'a-secure-password']);
        $foreignAccount = Account::create([
            'user_id' => $owner->id,
            'name' => 'Owner Bank',
            'type' => 'bank',
            'currency' => 'TZS',
            'opening_balance' => '50000.00',
        ]);
        $token = $other->createToken('tenant-isolation-test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/transactions', [
            'account_id' => $foreignAccount->id,
            'type' => 'expense',
            'amount' => '1000.00',
            'currency' => 'TZS',
            'category' => 'Food',
            'description' => 'Attempt to write to foreign account',
            'occurred_at' => '2026-10-31 10:00:00',
        ])->assertUnprocessable()->assertJsonValidationErrors('account_id');

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_financial_summary_contains_only_authenticated_users_ledger_entries(): void
    {
        $owner = User::create(['name' => 'Summary Owner', 'email' => 'summary-owner@example.com', 'password' => 'a-secure-password']);
        $viewer = User::create(['name' => 'Summary Viewer', 'email' => 'summary-viewer@example.com', 'password' => 'a-secure-password']);
        $ownerAccount = Account::create(['user_id' => $owner->id, 'name' => 'Owner Cash', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '0.00']);
        $viewerAccount = Account::create(['user_id' => $viewer->id, 'name' => 'Viewer Cash', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '0.00']);

        foreach ([[$owner, $ownerAccount, '900000.00', 'Owner salary'], [$viewer, $viewerAccount, '12500.00', 'Viewer salary']] as [$user, $account, $amount, $description]) {
            Transaction::create([
                'user_id' => $user->id,
                'account_id' => $account->id,
                'type' => 'income',
                'amount' => $amount,
                'currency' => 'TZS',
                'category' => 'Salary',
                'description' => $description,
                'occurred_at' => '2026-10-31 08:00:00',
                'status' => 'confirmed',
            ]);
        }

        $token = $viewer->createToken('tenant-isolation-test')->plainTextToken;
        $response = $this->withToken($token)->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')->assertOk();

        $this->assertSame('12500.00', $response->json('data.currencies.0.income'));
        $this->assertStringNotContainsString('900000.00', $response->getContent());
        $this->assertStringNotContainsString('Owner salary', $response->getContent());
    }
}
