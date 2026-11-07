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
}
