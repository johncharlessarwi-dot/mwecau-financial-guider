<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
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

        $transaction = $request->user()->transactions()->create($data + [
            'currency' => $account->currency,
            'category' => $data['category'] ?? 'Other',
            'status' => 'confirmed',
        ]);

        return response()->json(['data' => $transaction->load('account:id,name,type,currency')], 201);
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
        $transaction->update($data);

        return response()->json(['data' => $transaction->fresh()->load('account:id,name,type,currency')]);
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        abort_unless($transaction->user_id === $request->user()->id, 404);
        $transaction->delete();

        return response()->json(['message' => 'Transaction deleted.']);
    }
}
