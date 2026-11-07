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

    public function test_transfer_rejects_fractional_cents(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $payload = $this->transferPayload($wallet, $bank);
        $payload['amount'] = '10.001';
        $this->withToken($token)->postJson('/api/v1/transfers', $payload)->assertUnprocessable()->assertJsonValidationErrors('amount');
    }

    public function test_transaction_create_rejects_fractional_cents(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $payload = $this->transactionPayload($wallet);
        $payload['amount'] = '10.001';
        $this->withToken($token)->postJson('/api/v1/transactions', $payload)->assertUnprocessable()->assertJsonValidationErrors('amount');
    }

    public function test_transaction_update_rejects_fractional_cents(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transactions', $this->transactionPayload($wallet))->assertCreated()->json('data.id');
        $this->withToken($token)->patchJson('/api/v1/transactions/'.$id, ['amount' => '10.001'])->assertUnprocessable()->assertJsonValidationErrors('amount');
    }

    public function test_account_create_rejects_fractional_cents(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $this->withToken($token)->postJson('/api/v1/accounts', ['name' => 'Fractions', 'type' => 'cash', 'opening_balance' => '0.001'])->assertUnprocessable()->assertJsonValidationErrors('opening_balance');
    }

    public function test_transaction_filter_rejects_backwards_dates(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $this->withToken($token)->getJson('/api/v1/transactions?from=2026-11-02&to=2026-11-01')->assertUnprocessable()->assertJsonValidationErrors('to');
    }

    public function test_transaction_search_rejects_single_letter(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $this->withToken($token)->getJson('/api/v1/transactions?search=a')->assertUnprocessable()->assertJsonValidationErrors('search');
    }

    public function test_transaction_update_rejects_inactive_account(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transactions', $this->transactionPayload($wallet))->assertCreated()->json('data.id');
        $wallet->update(['is_active' => false]);
        $this->withToken($token)->patchJson('/api/v1/transactions/'.$id, ['description' => 'Changed'])->assertNotFound();
    }

    public function test_regular_transaction_still_allows_edits(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transactions', $this->transactionPayload($wallet))->assertCreated()->json('data.id');
        $this->withToken($token)->patchJson('/api/v1/transactions/'.$id, ['description' => 'Reconciled'])->assertOk()->assertJsonPath('data.description', 'Reconciled');
    }

    public function test_regular_transaction_still_allows_deletion(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $id = $this->withToken($token)->postJson('/api/v1/transactions', $this->transactionPayload($wallet))->assertCreated()->json('data.id');
        $this->withToken($token)->deleteJson('/api/v1/transactions/'.$id)->assertOk();
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_account_accepts_exactly_two_decimal_places(): void
    {
        [$user, $wallet, $bank, $token] = $this->session();
        $this->withToken($token)->postJson('/api/v1/accounts', ['name' => 'Savings', 'type' => 'bank', 'opening_balance' => '123.45'])->assertCreated()->assertJsonPath('data.opening_balance', '123.45');
    }

}
