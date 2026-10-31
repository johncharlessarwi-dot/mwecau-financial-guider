<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receive_an_authenticated_session(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/register', [
                'name' => 'Test User',
                'email' => 'TEST@example.com',
                'password' => 'a-secure-password',
            ])->assertCreated()
              ->assertJsonPath('user.email', 'test@example.com')
              ->assertJsonMissingPath('token');

        $user = User::where('email', 'test@example.com')->firstOrFail();

        $this->assertAuthenticatedAs($user, 'web');

        $this->withHeader('Origin', 'http://localhost:5173')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email);
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

    public function test_user_can_login_and_logout_of_a_session(): void
    {
        $user = User::create([
            'name' => 'Session User',
            'email' => 'session@example.com',
            'password' => 'a-secure-password',
        ]);

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/login', [
                'email' => 'SESSION@example.com',
                'password' => 'a-secure-password',
            ])->assertOk()
              ->assertJsonPath('user.id', $user->id)
              ->assertJsonMissingPath('token');

        $this->assertAuthenticatedAs($user, 'web');

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Session revoked.');

        $this->assertGuest('web');
    }

    public function test_login_rejects_invalid_credentials_without_disclosing_user_existence(): void
    {
        User::create([
            'name' => 'Existing',
            'email' => 'existing@example.com',
            'password' => 'a-secure-password',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'existing@example.com',
            'password' => 'incorrect-password',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors('email')
          ->assertJsonPath('errors.email.0', 'The supplied credentials are invalid.');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'missing@example.com',
            'password' => 'incorrect-password',
        ])->assertUnprocessable()
          ->assertJsonPath('errors.email.0', 'The supplied credentials are invalid.');
    }

    public function test_native_client_can_request_a_short_lived_scoped_bearer_token(): void
    {
        User::create([
            'name' => 'Mobile User',
            'email' => 'mobile@example.com',
            'password' => 'a-secure-password',
        ]);

        $response = $this->postJson('/api/v1/auth/token', [
            'email' => 'MOBILE@example.com',
            'password' => 'a-secure-password',
        ])->assertOk()
          ->assertJsonPath('token_type', 'Bearer')
          ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token', 'expires_at']);

        $storedToken = PersonalAccessToken::findToken($response->json('token'));
        $this->assertNotNull($storedToken);
        $this->assertSame(['read', 'write'], $storedToken->abilities);

        $this->withToken($response->json('token'))
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'mobile@example.com');
    }



    public function test_mobile_token_logout_revokes_the_token_and_prevents_reuse(): void
    {
        $user = User::factory()->create();
        $plainTextToken = $user->createToken('revocable-device', ['read', 'write'])->plainTextToken;

        $this->withToken($plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        $this->withToken($plainTextToken)
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Session revoked.');

        $this->assertDatabaseCount('personal_access_tokens', 0);

        // Reset Laravel's in-memory guard between simulated HTTP requests so
        // the second request must authenticate against the deleted token.
        $this->app['auth']->forgetGuards();

        $this->withToken($plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    public function test_expired_mobile_token_cannot_access_authenticated_endpoints(): void
    {
        $user = User::factory()->create();
        $expiredToken = $user->createToken(
            'expired-device',
            ['read', 'write'],
            now()->subMinute()
        )->plainTextToken;

        $this->withToken($expiredToken)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_read_only_mobile_token_cannot_mutate_financial_resources(): void
    {
        $user = User::factory()->create();
        $readToken = $user->createToken('read-only-device', ['read'])->plainTextToken;

        $this->withToken($readToken)
            ->getJson('/api/v1/accounts')
            ->assertOk();

        $this->withToken($readToken)
            ->postJson('/api/v1/accounts', [])
            ->assertForbidden();
    }


    public function test_login_endpoint_rate_limits_repeated_failed_attempts(): void
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'rate-limit@example.com',
                'password' => 'incorrect-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'rate-limit@example.com',
            'password' => 'incorrect-password',
        ])->assertTooManyRequests();
    }

    public function test_authenticated_endpoint_rejects_guest_requests(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_password_is_never_returned_by_authentication_endpoints(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173')->postJson('/api/v1/auth/register', [
            'name' => 'Private User',
            'email' => 'private@example.com',
            'password' => 'a-secure-password',
        ])->assertCreated()
          ->assertJsonMissingPath('user.password');
    }
}
