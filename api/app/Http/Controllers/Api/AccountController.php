<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->accounts()->where('is_active', true)->latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'type' => ['required', 'in:cash,bank,mobile_money,savings,other'],
            'currency' => ['sometimes', 'required', 'in:TZS,USD'],
            'opening_balance' => ['sometimes', 'numeric', 'min:0', 'max:9999999999999999.99'],
        ]);

        $account = $request->user()->accounts()->create($data + [
            'currency' => $data['currency'] ?? 'TZS',
            'opening_balance' => $data['opening_balance'] ?? '0.00',
        ]);

        return response()->json(['data' => $account], 201);
    }
}