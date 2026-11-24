<?php

namespace App\Observers;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class FinancialAuditObserver
{
    public function created(Model $model): void
    {
        $this->record($model, 'created', array_keys($model->getAttributes()));
    }

    public function updated(Model $model): void
    {
        $this->record($model, 'updated', array_keys($model->getChanges()));
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'deleted', array_keys($model->getOriginal()));
    }

    /**
     * Store field names only; never duplicate financial values or descriptions.
     *
     * @param array<int, string> $fields
     */
    private function record(Model $model, string $action, array $fields): void
    {
        if (! $model instanceof Account && ! $model instanceof Transaction) {
            return;
        }

        $ownerId = (int) $model->getAttribute('user_id');
        if ($ownerId < 1) {
            return;
        }

        $actorId = Auth::id();
        if ($actorId !== null && (int) $actorId !== $ownerId) {
            $actorId = null;
        }

        $request = app()->bound('request') ? request() : null;

        AuditLog::query()->create([
            'user_id' => $ownerId,
            'actor_user_id' => $actorId,
            'auditable_type' => $model->getMorphClass(),
            'auditable_id' => (int) $model->getKey(),
            'action' => $action,
            'changed_fields' => array_values(array_unique($fields)),
            'ip_address' => $request?->ip(),
            'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 500) : null,
            'created_at' => now(),
        ]);
    }
}
