<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialSafetyRegressionTest extends TestCase
{
    use RefreshDatabase;

    private function session(): array
    {
        $user = User::factory()->create();
        $wallet = Account::create(['user_id' => $user->id, 'name' => 'Wallet', 'type' => 'cash', 'currency' => 'TZS']);
        $bank = Account::create(['user_id' => $user->id, 'name' => 'Bank', 'type' => 'bank', 'currency' => 'TZS']);
        return [$user, $wallet, $bank, $user->createToken('financial-safety', ['read', 'write'])->plainTextToken];
    }

    private function transferPayload(Account $wallet, Account $bank): array
    {
        return ['from_account_id' => $wallet->id, 'to_account_id' => $bank->id, 'amount' => '100.00'];
    }

    private function transactionPayload(Account $wallet): array
    {
        return ['account_id' => $wallet->id, 'type' => 'expense', 'amount' => '100.00',
            'description' => 'Safety test', 'occurred_at' => '2026-10-31 10:00:00'];
    }
    public function test_transfer_ledger_entries_cannot_be_edited(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transfers', $this->transferPayload($wallet, $bank))->assertCreated()->json('data.0.id');
        $this->withToken($token)->patchJson('/api/v1/transactions/'.$id, ['amount' => '1.00'])->assertStatus(409);
        $this->assertDatabaseHas('transactions', ['id' => $id, 'amount' => '100.00']);
    }

    public function test_transfer_ledger_entries_cannot_be_deleted(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transfers', $this->transferPayload($wallet, $bank))->assertCreated()->json('data.0.id');
        $this->withToken($token)->deleteJson('/api/v1/transactions/'.$id)->assertStatus(409);
        $this->assertDatabaseCount('transactions', 2);
    }

    public function test_transfer_credit_leg_cannot_be_edited(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transfers', $this->transferPayload($wallet, $bank))->assertCreated()->json('data.1.id');
        $this->withToken($token)->patchJson('/api/v1/transactions/'.$id, ['description' => 'Tampered'])->assertStatus(409);
    }

    public function test_transfer_credit_leg_cannot_be_deleted(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transfers', $this->transferPayload($wallet, $bank))->assertCreated()->json('data.1.id');
        $this->withToken($token)->deleteJson('/api/v1/transactions/'.$id)->assertStatus(409);
        $this->assertDatabaseCount('transactions', 2);
    }

    public function test_inactive_transfer_source_is_rejected(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $wallet->update(['is_active' => false]);
        $this->withToken($token)->postJson('/api/v1/transfers', $this->transferPayload($wallet, $bank))->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_inactive_transfer_destination_is_rejected(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $bank->update(['is_active' => false]);
        $this->withToken($token)->postJson('/api/v1/transfers', $this->transferPayload($wallet, $bank))->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 0);
    }

}
