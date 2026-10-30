<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_a_tzs_account(): void
    {
        $user = User::create(['name' => 'Account Owner', 'email' => 'account@example.com', 'password' => 'a-secure-password']);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/accounts', [
            'name' => 'My mobile wallet',
            'type' => 'mobile_money',
            'opening_balance' => '125000.00',
        ])->assertCreated()
          ->assertJsonPath('data.currency', 'TZS')
          ->assertJsonPath('data.opening_balance', '125000.00');

        $this->assertDatabaseHas('accounts', ['user_id' => $user->id, 'name' => 'My mobile wallet']);
    }

    public function test_account_list_contains_only_authenticated_users_accounts(): void
    {
        $first = User::create(['name' => 'First', 'email' => 'first@example.com', 'password' => 'a-secure-password']);
        $second = User::create(['name' => 'Second', 'email' => 'second@example.com', 'password' => 'a-secure-password']);

        Account::create(['user_id' => $first->id, 'name' => 'First wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => '0.00']);
        Account::create(['user_id' => $second->id, 'name' => 'Second wallet', 'type' => 'bank', 'currency' => 'TZS', 'opening_balance' => '0.00']);

        $token = $first->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/accounts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'First wallet');
    }
}