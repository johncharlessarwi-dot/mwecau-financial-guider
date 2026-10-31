<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['sometimes', 'in:income,expense'],
            'account_id' => ['sometimes', 'integer'],
            'category' => ['sometimes', 'string', 'max:60'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date'],
            'search' => ['sometimes', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $transactions = $request->user()->transactions()
            ->with('account:id,name,type,currency')
            ->when(isset($filters['type']), fn (Builder $query) => $query->where('type', $filters['type']))
            ->when(isset($filters['account_id']), fn (Builder $query) => $query->where('account_id', $filters['account_id']))
            ->when(isset($filters['category']), fn (Builder $query) => $query->where('category', $filters['category']))
            ->when(isset($filters['from']), fn (Builder $query) => $query->whereDate('occurred_at', '>=', $filters['from']))
            ->when(isset($filters['to']), fn (Builder $query) => $query->whereDate('occurred_at', '<=', $filters['to']))
            ->when(isset($filters['search']), fn (Builder $query) => $query->where('description', 'like', '%'.$filters['search'].'%'))
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20)
            ->withQueryString();

        return response()->json($transactions);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('user_id', $request->user()->id)->where('is_active', true)],
            'type' => ['required', 'in:income,expense'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999999999.99'],
            'currency' => ['sometimes', 'required', 'in:TZS,USD'],
            'category' => ['sometimes', 'string', 'max:60'],
            'description' => ['required', 'string', 'max:180'],
            'occurred_at' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:80'],
        ]);

        $account = $request->user()->accounts()->whereKey($data['account_id'])->firstOrFail();
        $currency = $data['currency'] ?? $account->currency;

        if ($currency !== $account->currency) {
            throw ValidationException::withMessages(['currency' => 'Transaction currency must match the selected account currency.']);
        }

        $idempotencyKey = $request->header('Idempotency-Key');

        if ($idempotencyKey === null) {
            $transaction = DB::transaction(fn () => $request->user()->transactions()->create($data + [
                'currency' => $account->currency,
                'category' => $data['category'] ?? 'Other',
                'status' => 'confirmed',
            ]));

            return response()->json(['data' => $transaction->load('account:id,name,type,currency')], 201);
        }

        if (strlen($idempotencyKey) < 16 || strlen($idempotencyKey) > 128) {
            return response()->json(['message' => 'Idempotency-Key must contain between 16 and 128 characters.'], 422);
        }

        $user = $request->user();
        $requestHash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($user, $account, $data, $idempotencyKey, $requestHash): JsonResponse {
                $existing = DB::table('idempotency_records')
                    ->where('user_id', $user->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    return $this->resolveIdempotencyReplay($existing, $requestHash);
                }

                $recordId = DB::table('idempotency_records')->insertGetId([
                    'user_id' => $user->id,
                    'idempotency_key' => $idempotencyKey,
                    'request_hash' => $requestHash,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $transaction = $user->transactions()->create($data + [
                    'currency' => $account->currency,
                    'category' => $data['category'] ?? 'Other',
                    'status' => 'confirmed',
                ]);

                $body = ['data' => $transaction->load('account:id,name,type,currency')->toArray()];

                DB::table('idempotency_records')->where('id', $recordId)->update([
                    'response_status' => 201,
                    'response_body' => json_encode($body, JSON_THROW_ON_ERROR),
                    'updated_at' => now(),
                ]);

                return response()->json($body, 201);
            });
        } catch (QueryException $exception) {
            $existing = DB::table('idempotency_records')
                ->where('user_id', $user->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if (! $existing) {
                throw $exception;
            }

            return $this->resolveIdempotencyReplay($existing, $requestHash);
        }
    }

    private function resolveIdempotencyReplay(object $record, string $requestHash): JsonResponse
    {
        if (! hash_equals($record->request_hash, $requestHash)) {
            return response()->json([
                'message' => 'This Idempotency-Key was already used with a different transaction payload.',
            ], 409);
        }

        if ($record->response_status === null || $record->response_body === null) {
            return response()->json(['message' => 'The original request is still being processed. Retry shortly.'], 409);
        }

        $body = is_array($record->response_body)
            ? $record->response_body
            : json_decode($record->response_body, true, flags: JSON_THROW_ON_ERROR);

        return response()->json($body, (int) $record->response_status);
    }

    public function update(Request $request, Transaction $transaction): JsonResponse
    {
        abort_unless($transaction->user_id === $request->user()->id, 404);

        $data = $request->validate([
            'account_id' => ['sometimes', 'required', 'integer', Rule::exists('accounts', 'id')->where('user_id', $request->user()->id)->where('is_active', true)],
            'type' => ['sometimes', 'required', 'in:income,expense'],
            'amount' => ['sometimes', 'required', 'numeric', 'gt:0', 'max:9999999999999999.99'],
            'currency' => ['sometimes', 'required', 'in:TZS,USD'],
            'category' => ['sometimes', 'required', 'string', 'max:60'],
            'description' => ['sometimes', 'required', 'string', 'max:180'],
            'occurred_at' => ['sometimes', 'required', 'date'],
            'reference' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        $accountId = $data['account_id'] ?? $transaction->account_id;
        $account = $request->user()->accounts()->whereKey($accountId)->firstOrFail();
        $currency = $data['currency'] ?? $account->currency;

        if ($currency !== $account->currency) {
            throw ValidationException::withMessages(['currency' => 'Transaction currency must match the selected account currency.']);
        }

        $data['currency'] = $account->currency;
        $updated = DB::transaction(function () use ($transaction, $data): Transaction {
            $transaction->update($data);

            return $transaction->fresh()->load('account:id,name,type,currency');
        });

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        abort_unless($transaction->user_id === $request->user()->id, 404);
        DB::transaction(fn () => $transaction->delete());

        return response()->json(['message' => 'Transaction deleted.']);
    }
}
