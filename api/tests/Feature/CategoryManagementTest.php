<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_categories_require_authentication(): void
    {
        $this->getJson('/api/v1/categories')->assertUnauthorized();
    }

    public function test_user_sees_system_and_own_categories_but_not_other_users_categories(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        Category::create(['type' => 'expense', 'name' => 'Food', 'is_system' => true]);
        $own = $user->categories()->create(['type' => 'expense', 'name' => 'Transport']);
        $other->categories()->create(['type' => 'expense', 'name' => 'Private']);

        Sanctum::actingAs($user, ['read', 'write']);
        $response = $this->getJson('/api/v1/categories')->assertOk();

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertContains($own->id, $ids);
        $this->assertCount(2, $ids);
    }

    public function test_user_can_create_and_deactivate_only_their_own_category(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $foreign = $other->categories()->create(['type' => 'income', 'name' => 'Salary']);
        Sanctum::actingAs($user, ['read', 'write']);

        $created = $this->postJson('/api/v1/categories', [
            'type' => 'expense', 'name' => 'Transport', 'color' => '#123456', 'icon' => 'bus',
        ])->assertCreated()->assertJsonPath('data.name', 'Transport');

        $this->patchJson('/api/v1/categories/'.$foreign->id, ['name' => 'Changed'])->assertNotFound();
        $this->deleteJson('/api/v1/categories/'.$foreign->id)->assertNotFound();
        $this->deleteJson('/api/v1/categories/'.$created->json('data.id'))->assertOk();
        $this->assertDatabaseHas('categories', ['id' => $created->json('data.id'), 'is_active' => false]);
    }

    public function test_category_rejects_invalid_color_icon_and_duplicate_names(): void
    {
        Sanctum::actingAs(User::factory()->create(), ['read', 'write']);
        $this->postJson('/api/v1/categories', ['type' => 'expense', 'name' => 'Food', 'color' => 'red'])->assertUnprocessable();
        $this->postJson('/api/v1/categories', ['type' => 'expense', 'name' => 'Food', 'icon' => '<script>'])->assertUnprocessable();
        $this->postJson('/api/v1/categories', ['type' => 'expense', 'name' => 'Food'])->assertCreated();
        $this->postJson('/api/v1/categories', ['type' => 'expense', 'name' => 'food'])->assertUnprocessable();
    }
}