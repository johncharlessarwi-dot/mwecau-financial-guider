<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Transaction;
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

    public function test_transaction_create_update_and_delete_events_are_audited_without_storing_values(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $account = Account::query()->create([
            'user_id' => $user->id,
            'name' => 'Lifecycle wallet',
            'type' => 'cash',
            'currency' => 'TZS',
            'opening_balance' => '0',
            'is_active' => true,
        ]);

        $transaction = Transaction::query()->create([
            'user_id' => $user->id,
            'account_id' => $account->id,
            'type' => 'expense',
            'amount' => '87654.32',
            'currency' => 'TZS',
            'category' => 'Other',
            'description' => 'Private transaction description',
            'occurred_at' => now(),
            'status' => 'confirmed',
        ]);

        $transaction->update([
            'amount' => '91234.56',
            'description' => 'Updated private description',
        ]);
        $transaction->delete();

        $logs = AuditLog::query()
            ->where('user_id', $user->id)
            ->where('auditable_type', Transaction::class)
            ->where('auditable_id', $transaction->id)
            ->orderBy('id')
            ->get();

        $this->assertSame(['created', 'updated', 'deleted'], $logs->pluck('action')->all());
        $this->assertContains('amount', $logs[1]->changed_fields);
        $this->assertContains('description', $logs[1]->changed_fields);
        $this->assertSame($user->id, $logs[0]->actor_user_id);

        $serializedLogs = $logs->toJson();
        $this->assertStringNotContainsString('87654.32', $serializedLogs);
        $this->assertStringNotContainsString('91234.56', $serializedLogs);
        $this->assertStringNotContainsString('Private transaction description', $serializedLogs);
        $this->assertStringNotContainsString('Updated private description', $serializedLogs);
    }

    public function test_transfer_writes_audit_entries_for_both_ledger_sides(): void
    {
        $user = User::factory()->create();
        $source = Account::query()->create([
            'user_id' => $user->id,
            'name' => 'Source wallet',
            'type' => 'cash',
            'currency' => 'TZS',
            'opening_balance' => '100000',
            'is_active' => true,
        ]);
        $destination = Account::query()->create([
            'user_id' => $user->id,
            'name' => 'Destination bank',
            'type' => 'bank',
            'currency' => 'TZS',
            'opening_balance' => '0',
            'is_active' => true,
        ]);
        $token = $user->createToken('audit-transfer-test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/transfers', [
            'from_account_id' => $source->id,
            'to_account_id' => $destination->id,
            'amount' => '25000.00',
            'description' => 'Confidential transfer note',
            'occurred_at' => '2026-10-31 10:00:00',
        ])->assertCreated();

        $transactionIds = collect($response->json('data'))->pluck('id')->all();
        $logs = AuditLog::query()
            ->where('user_id', $user->id)
            ->where('auditable_type', Transaction::class)
            ->whereIn('auditable_id', $transactionIds)
            ->get();

        $this->assertCount(2, $logs);
        $this->assertSame(['created', 'created'], $logs->pluck('action')->all());
        $this->assertSame([$user->id, $user->id], $logs->pluck('actor_user_id')->all());
        $this->assertStringNotContainsString('25000.00', $logs->toJson());
        $this->assertStringNotContainsString('Confidential transfer note', $logs->toJson());
    }
}
