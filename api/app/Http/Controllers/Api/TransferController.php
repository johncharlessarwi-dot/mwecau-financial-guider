<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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

        $transfer = DB::transaction(function () use ($data, $user): array {
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
        }, attempts: 3);

        return response()->json([
            'message' => 'Transfer recorded.',
            'transfer_reference' => $transfer[0]->transfer_reference,
            'data' => [
                $transfer[0]->load('account:id,name,type,currency'),
                $transfer[1]->load('account:id,name,type,currency'),
            ],
        ], 201);
    }
}
