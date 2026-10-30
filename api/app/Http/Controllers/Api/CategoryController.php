<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['sometimes', 'in:income,expense'],
            'include_inactive' => ['sometimes', 'boolean'],
        ]);

        $categories = \App\Models\Category::query()
            ->where(function ($query) use ($request): void {
                $query->whereNull('user_id')->where('is_system', true)
                    ->orWhere('user_id', $request->user()->id);
            })
            ->when(isset($filters['type']), fn ($query) => $query->where('type', $filters['type']))
            ->when(! ($filters['include_inactive'] ?? false), fn ($query) => $query->where('is_active', true))
            ->orderBy('type')->orderBy('name')->paginate(100);

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:income,expense'],
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon' => ['nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
        ]);

        $duplicate = \App\Models\Category::query()
            ->where('user_id', $request->user()->id)
            ->where('type', $data['type'])
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($data['name'])])
            ->exists();

        if ($duplicate) {
            return response()->json(['message' => 'A category with this name and type already exists.'], 422);
        }

        $category = $request->user()->categories()->create($data);

        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, int $category): JsonResponse
    {
        $record = $request->user()->categories()->whereKey($category)->firstOrFail();
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:60'],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/'],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);

        if (isset($data['name'])) {
            $duplicate = $request->user()->categories()
                ->where('type', $record->type)
                ->whereKeyNot($record->id)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($data['name'])])
                ->exists();

            if ($duplicate) {
                return response()->json(['message' => 'A category with this name and type already exists.'], 422);
            }
        }

        $record->update($data);

        return response()->json(['data' => $record->fresh()]);
    }

    public function destroy(Request $request, int $category): JsonResponse
    {
        $record = $request->user()->categories()->whereKey($category)->firstOrFail();
        $record->update(['is_active' => false]);

        return response()->json(['message' => 'Category deactivated.']);
    }
}