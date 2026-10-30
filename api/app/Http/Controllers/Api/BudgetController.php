<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $budgets = $request->user()->budgets()
            ->with('category:id,name,type')
            ->when(isset($filters['is_active']), fn (Builder $query) => $query->where('is_active', $filters['is_active']))
            ->latest()
            ->paginate($filters['per_page'] ?? 20);

        $budgets->getCollection()->transform(fn (Budget $budget) => $this->withProgress($request, $budget));

        return response()->json($budgets);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedData($request);
        $budget = $request->user()->budgets()->create($data);

        return response()->json(['data' => $this->withProgress($request, $budget->load('category:id,name,type'))], 201);
    }

    public function update(Request $request, int $budget): JsonResponse
    {
        $record = $request->user()->budgets()->whereKey($budget)->firstOrFail();
        $data = $this->validatedData($request, true);
        $record->update($data);

        return response()->json(['data' => $this->withProgress($request, $record->fresh()->load('category:id,name,type'))]);
    }

    public function destroy(Request $request, int $budget): JsonResponse
    {
        $record = $request->user()->budgets()->whereKey($budget)->firstOrFail();
        $record->update(['is_active' => false]);

        return response()->json(['message' => 'Budget deactivated.']);
    }

    private function validatedData(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes|required' : 'required';

        $data = $request->validate([
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('categories', 'id')->where(fn ($query) => $query->where('type', 'expense')->where('is_active', true)->where(fn ($scope) => $scope->whereNull('user_id')->where('is_system', true)->orWhere('user_id', $request->user()->id)))],
            'name' => [$required, 'string', 'min:2', 'max:80'],
            'amount' => [$required, 'numeric', 'gt:0', 'max:9999999999999999.99'],
            'currency' => [$required === 'required' ? 'sometimes' : 'sometimes', 'required', 'in:TZS,USD'],
            'period' => [$required, 'in:weekly,monthly,yearly,custom'],
            'start_date' => [$required, 'date'],
            'end_date' => [$required, 'date', 'after_or_equal:start_date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return $data;
    }

    private function withProgress(Request $request, Budget $budget): array
    {
        $spending = $request->user()->transactions()
            ->where('type', 'expense')
            ->where('status', 'confirmed')
            ->whereNull('transfer_reference')
            ->where('currency', $budget->currency)
            ->whereDate('occurred_at', '>=', $budget->start_date->toDateString())
            ->whereDate('occurred_at', '<=', $budget->end_date->toDateString())
            ->when($budget->category_id, fn (Builder $query) => $query->where('category', $budget->category?->name))
            ->sum('amount');

        $amountCents = $this->toCents((string) $budget->amount);
        $spentCents = $this->toCents((string) $spending);
        $remainingCents = $amountCents - $spentCents;

        return [
            'id' => $budget->id,
            'name' => $budget->name,
            'category' => $budget->category,
            'category_id' => $budget->category_id,
            'amount' => $budget->amount,
            'currency' => $budget->currency,
            'period' => $budget->period,
            'start_date' => $budget->start_date->toDateString(),
            'end_date' => $budget->end_date->toDateString(),
            'is_active' => $budget->is_active,
            'spent_amount' => $this->formatCents($spentCents),
            'remaining_amount' => $this->formatCents($remainingCents),
            'percentage_used' => $amountCents > 0 ? round(($spentCents / $amountCents) * 100, 2) : 0,
            'overspent' => $spentCents > $amountCents,
        ];
    }

    private function toCents(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '0');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    private function formatCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $absolute = abs($cents);

        return $sign.intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);
    }
}