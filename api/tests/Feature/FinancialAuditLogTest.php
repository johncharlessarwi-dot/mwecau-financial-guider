<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialAuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_creation_writes_private_audit_entry_without_financial_values(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $account = Account::query()->create([
            'user_id' => $user->id,
            'name' => 'Personal wallet',
            'type' => 'cash',
            'currency' => 'TZS',
            'opening_balance' => '150000.00',
            'is_active' => true,
        ]);

        $log = AuditLog::query()->where('user_id', $user->id)->first();

        $this->assertNotNull($log);
        $this->assertSame('created', $log->action);
        $this->assertSame(Account::class, $log->auditable_type);
        $this->assertSame($account->id, $log->auditable_id);
        $this->assertContains('opening_balance', $log->changed_fields);
        $this->assertStringNotContainsString('150000', json_encode($log->toArray()));
    }

    public function test_audit_logs_are_partitioned_by_owner(): void
    {
        $first = User::factory()->create();
        $second = User::factory()->create();

        Account::query()->create([
            'user_id' => $first->id,
            'name' => 'First wallet',
            'type' => 'cash',
            'currency' => 'TZS',
            'opening_balance' => '0',
            'is_active' => true,
        ]);
        Account::query()->create([
            'user_id' => $second->id,
            'name' => 'Second wallet',
            'type' => 'cash',
            'currency' => 'TZS',
            'opening_balance' => '0',
            'is_active' => true,
        ]);

        $this->assertSame(1, AuditLog::query()->where('user_id', $first->id)->count());
        $this->assertSame(1, AuditLog::query()->where('user_id', $second->id)->count());
    }
}
