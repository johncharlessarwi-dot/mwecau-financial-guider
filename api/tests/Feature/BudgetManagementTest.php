<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BudgetManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_budget_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/budgets')->assertUnauthorized();
        $this->postJson('/api/v1/budgets', [])->assertUnauthorized();
    }

    public function test_budget_progress_counts_only_matching_confirmed_expenses_and_excludes_transfers(): void
    {
        $user = User::factory()->create();
        $category = $user->categories()->create(['type' => 'expense', 'name' => 'Food']);
        $account = $user->accounts()->create(['name' => 'Wallet', 'type' => 'cash', 'currency' => 'TZS', 'opening_balance' => 0]);
        $budget = $user->budgets()->create([
            'category_id' => $category->id, 'name' => 'Food monthly', 'amount' => 100000,
            'currency' => 'TZS', 'period' => 'monthly', 'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
        ]);
        $base = ['user_id' => $user->id, 'account_id' => $account->id, 'type' => 'expense', 'currency' => 'TZS', 'description' => 'Expense', 'occurred_at' => '2026-10-15 10:00:00', 'status' => 'confirmed'];
        Transaction::create(array_merge($base, ['amount' => 25000, 'category' => 'Food']));
        Transaction::create(array_merge($base, ['amount' => 90000, 'category' => 'Food', 'transfer_reference' => '550e8400-e29b-41d4-a716-446655440000']));
        Transaction::create(array_merge($base, ['amount' => 50000, 'category' => 'Transport']));
        Transaction::create(array_merge($base, ['amount' => 50000, 'category' => 'Food', 'currency' => 'USD']));
        Transaction::create(array_merge($base, ['amount' => 50000, 'category' => 'Food', 'occurred_at' => '2026-11-01 10:00:00']));

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/budgets')->assertOk()
            ->assertJsonPath('data.0.id', $budget->id)
            ->assertJsonPath('data.0.spent_amount', '25000.00')
            ->assertJsonPath('data.0.remaining_amount', '75000.00')
            ->assertJsonPath('data.0.percentage_used', 25)
            ->assertJsonPath('data.0.overspent', false);
    }

    public function test_budgets_are_tenant_scoped_and_category_must_be_owned_expense_category(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $foreignCategory = $other->categories()->create(['type' => 'expense', 'name' => 'Private']);
        $foreignBudget = $other->budgets()->create([
            'name' => 'Private budget', 'amount' => 1000, 'currency' => 'TZS',
            'period' => 'monthly', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31',
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/budgets', [
            'category_id' => $foreignCategory->id, 'name' => 'Bad', 'amount' => 1000,
            'currency' => 'TZS', 'period' => 'monthly', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31',
        ])->assertUnprocessable();

        $this->patchJson('/api/v1/budgets/'.$foreignBudget->id, ['name' => 'Hijack'])->assertNotFound();
        $this->deleteJson('/api/v1/budgets/'.$foreignBudget->id)->assertNotFound();
        $this->assertDatabaseHas('budgets', ['id' => $foreignBudget->id, 'name' => 'Private budget']);
    }

    public function test_budget_rejects_invalid_ranges_and_amounts(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $payload = ['name' => 'Monthly', 'amount' => 0, 'currency' => 'TZS', 'period' => 'monthly', 'start_date' => '2026-10-31', 'end_date' => '2026-10-01'];
        $this->postJson('/api/v1/budgets', $payload)->assertUnprocessable();
    }

    public function test_partial_date_updates_preserve_and_validate_the_effective_budget_range(): void
    {
        $user = User::factory()->create();
        $budget = $user->budgets()->create([
            'name' => 'October plan',
            'amount' => 100000,
            'currency' => 'TZS',
            'period' => 'monthly',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
        ]);

        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/budgets/'.$budget->id, ['end_date' => '2026-09-30'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('end_date');

        $this->patchJson('/api/v1/budgets/'.$budget->id, ['end_date' => '2026-11-30'])
            ->assertOk()
            ->assertJsonPath('data.end_date', '2026-11-30');

        $this->patchJson('/api/v1/budgets/'.$budget->id, ['start_date' => '2026-12-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('end_date');
    }

    public function test_budget_rejects_unsupported_currency(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/budgets', [
            'name' => 'Unsupported currency',
            'amount' => 1000,
            'currency' => 'EUR',
            'period' => 'monthly',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
        ])->assertUnprocessable()->assertJsonValidationErrors('currency');
    }

    public function test_budget_rejects_amounts_with_more_than_two_decimal_places(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/budgets', [
            'name' => 'Precise budget',
            'amount' => '1000.123',
            'currency' => 'TZS',
            'period' => 'monthly',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
        ])->assertUnprocessable()->assertJsonValidationErrors('amount');
    }
}
