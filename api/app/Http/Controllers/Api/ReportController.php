<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Carbon\CarbonImmutable;

class ReportController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'from' => ['sometimes', 'required', 'date'],
            'to' => ['sometimes', 'required', 'date'],
            'currency' => ['sometimes', 'required', 'in:TZS,USD'],
        ]);

        $from = CarbonImmutable::parse($filters['from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $to = CarbonImmutable::parse($filters['to'] ?? now()->toDateString())->endOfDay();

        if ($to->lt($from)) {
            throw ValidationException::withMessages(['to' => 'The end date must be on or after the start date.']);
        }

        if ($from->diffInDays($to) > 366) {
            throw ValidationException::withMessages(['to' => 'Report date ranges cannot exceed 366 days.']);
        }

        $base = $request->user()->transactions()
            ->where('status', 'confirmed')
            ->whereNull('transfer_reference')
            ->whereBetween('occurred_at', [$from, $to])
            ->when(isset($filters['currency']), fn (Builder $query) => $query->where('currency', $filters['currency']));

        $totals = (clone $base)
            ->selectRaw('currency, type, SUM(amount) as total')
            ->groupBy('currency', 'type')
            ->get();

        $categories = (clone $base)
            ->selectRaw('currency, type, category, SUM(amount) as total')
            ->groupBy('currency', 'type', 'category')
            ->orderBy('currency')
            ->orderBy('type')
            ->get();

        $currencies = collect(['TZS', 'USD'])
            ->filter(fn (string $currency) => !isset($filters['currency']) || $filters['currency'] === $currency)
            ->map(function (string $currency) use ($totals, $categories): array {
                $income = $this->toCents((string) ($totals->first(fn ($row) => $row->currency === $currency && $row->type === 'income')?->total ?? '0'));
                $expenses = $this->toCents((string) ($totals->first(fn ($row) => $row->currency === $currency && $row->type === 'expense')?->total ?? '0'));
                $breakdown = $categories->where('currency', $currency)->map(fn ($row) => [
                    'type' => $row->type,
                    'category' => $row->category,
                    'amount' => $this->formatCents($this->toCents((string) $row->total)),
                ])->values();

                return [
                    'currency' => $currency,
                    'income' => $this->formatCents($income),
                    'expenses' => $this->formatCents($expenses),
                    'net_cash_flow' => $this->formatCents($income - $expenses),
                    'categories' => $breakdown,
                ];
            })->values();

        return response()->json([
            'data' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'currencies' => $currencies,
            ],
        ]);
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
