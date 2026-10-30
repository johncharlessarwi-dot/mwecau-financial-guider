<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receive_a_bearer_token(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'a-secure-password',
        ])->assertCreated()
          ->assertJsonPath('user.email', 'test@example.com')
          ->assertJsonPath('token_type', 'Bearer')
          ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);
    }

    public function test_duplicate_email_registration_is_rejected(): void
    {
        User::create(['name' => 'Existing', 'email' => 'same@example.com', 'password' => 'a-secure-password']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Second User',
            'email' => 'same@example.com',
            'password' => 'another-secure-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_authenticated_user_can_revoke_current_token(): void
    {
        $user = User::create(['name' => 'Token User', 'email' => 'token@example.com', 'password' => 'a-secure-password']);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')
            ->assertOk()->assertJsonPath('message', 'Session revoked.');
    }
}