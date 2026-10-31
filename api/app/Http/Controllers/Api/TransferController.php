<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\Account;
use App\\Models\\User;
use Illuminate\\Database\\QueryException;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;
use Illuminate\\Validation\\Rule;
use Illuminate\\Validation\\ValidationException;

class TransferController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'from_account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('user_id', $user->id)->where('is_active', true)],
            'to_account_id' => ['required', 'integer', 'different:from_account_id', Rule::exists('accounts', 'id')->where('user_id', $user->id)->where('is_active', true)],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999999999.99'],
            'description' => ['nullable', 'string', 'max:180'],
            'occurred_at' => ['sometimes', 'date'],
        ]);

        $idempotencyKey = $request->header('Idempotency-Key');
        if ($idempotencyKey === null) {
            $transfer = DB::transaction(fn (): array => $this->createTransferEntries($data, $user), attempts: 3);

            return response()->json($this->transferResponseBody($transfer), 201);
        }

        if (strlen($idempotencyKey) < 16 || strlen($idempotencyKey) > 128) {
            return response()->json(['message' => 'Idempotency-Key must contain between 16 and 128 characters.'], 422);
        }

        $requestHash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($user, $data, $idempotencyKey, $requestHash): JsonResponse {
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

                $transfer = $this->createTransferEntries($data, $user);
                $body = $this->transferResponseBody($transfer);

                DB::table('idempotency_records')->where('id', $recordId)->update([
                    'response_status' => 201,
                    'response_body' => json_encode($body, JSON_THROW_ON_ERROR),
                    'updated_at' => now(),
                ]);

                return response()->json($body, 201);
            }, attempts: 3);
        } catch (QueryException $exception) {
            // A concurrent request may win the unique (user_id, key) insert.
            // Read its committed result and replay it instead of creating a second transfer.
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

    /**
     * Create both ledger sides inside the caller's database transaction.
     *
     * @param array<string, mixed> $data
     * @return array{0: \\App\\Models\\Transaction, 1: \\App\\Models\\Transaction}
     */
    private function createTransferEntries(array $data, User $user): array
    {
        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->whereIn('id', [$data['from_account_id'], $data['to_account_id']])
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        $source = $accounts->get($data['from_account_id']);
        $destination = $accounts->get($data['to_account_id']);

        if (! $source || ! $destination) {
            throw ValidationException::withMessages(['account_id' => 'Both accounts must belong to your profile and be active.']);
        }

        if ($source->currency !== $destination->currency) {
            throw ValidationException::withMessages(['to_account_id' => 'Transfers require accounts with the same currency.']);
        }

        $reference = (string) Str::uuid();
        $occurredAt = $data['occurred_at'] ?? now();
        $description = $data['description'] ?? 'Account transfer';

        $debit = $user->transactions()->create([
            'account_id' => $source->id,
            'type' => 'expense',
            'amount' => $data['amount'],
            'currency' => $source->currency,
            'category' => 'Transfer',
            'description' => $description.' (to '.$destination->name.')',
            'occurred_at' => $occurredAt,
            'transfer_reference' => $reference,
            'status' => 'confirmed',
        ]);

        $credit = $user->transactions()->create([
            'account_id' => $destination->id,
            'type' => 'income',
            'amount' => $data['amount'],
            'currency' => $destination->currency,
            'category' => 'Transfer',
            'description' => $description.' (from '.$source->name.')',
            'occurred_at' => $occurredAt,
            'transfer_reference' => $reference,
            'status' => 'confirmed',
        ]);

        return [$debit, $credit];
    }

    /**
     * @param array{0: \\App\\Models\\Transaction, 1: \\App\\Models\\Transaction} $transfer
     * @return array<string, mixed>
     */
    private function transferResponseBody(array $transfer): array
    {
        return [
            'message' => 'Transfer recorded.',
            'transfer_reference' => $transfer[0]->transfer_reference,
            'data' => [
                $transfer[0]->load('account:id,name,type,currency')->toArray(),
                $transfer[1]->load('account:id,name,type,currency')->toArray(),
            ],
        ];
    }

    private function resolveIdempotencyReplay(object $record, string $requestHash): JsonResponse
    {
        if (! hash_equals($record->request_hash, $requestHash)) {
            return response()->json([
                'message' => 'This Idempotency-Key was already used with a different transfer payload.',
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
}
