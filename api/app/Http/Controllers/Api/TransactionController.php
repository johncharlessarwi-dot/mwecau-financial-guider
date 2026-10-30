<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $transactions = $request->user()->transactions()
            ->with('account:id,name,type,currency')
            ->orderByDesc('occurred_at')
            ->paginate(min(max((int) $request->query('per_page', 20), 1), 100));

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

        $transaction = $request->user()->transactions()->create($data + [
            'currency' => $data['currency'] ?? 'TZS',
            'category' => $data['category'] ?? 'Other',
            'status' => 'confirmed',
        ]);

        return response()->json(['data' => $transaction->load('account:id,name,type,currency')], 201);
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        abort_unless($transaction->user_id === $request->user()->id, 404);
        $transaction->delete();

        return response()->json(['message' => 'Transaction deleted.']);
    }
}