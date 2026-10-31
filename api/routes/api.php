<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\TransferController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'service' => 'MWECau GUIDER API',
            'status' => 'ok',
            'version' => 'v1',
        ]);
    });

    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/token', [AuthController::class, 'createMobileToken'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me'])->middleware('abilities:read');
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/accounts', [AccountController::class, 'index'])->middleware('abilities:read');
        Route::post('/accounts', [AccountController::class, 'store'])->middleware(['throttle:20,1', 'abilities:write']);
        Route::get('/categories', [CategoryController::class, 'index'])->middleware('abilities:read');
        Route::post('/categories', [CategoryController::class, 'store'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::patch('/categories/{category}', [CategoryController::class, 'update'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::get('/budgets', [BudgetController::class, 'index'])->middleware('abilities:read');
        Route::get('/reports/summary', [ReportController::class, 'summary'])->middleware('throttle:60,1')->middleware('abilities:read');
        Route::post('/budgets', [BudgetController::class, 'store'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::patch('/budgets/{budget}', [BudgetController::class, 'update'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::delete('/budgets/{budget}', [BudgetController::class, 'destroy'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::post('/transfers', [TransferController::class, 'store'])->middleware(['throttle:20,1', 'abilities:write']);
        Route::get('/transactions', [TransactionController::class, 'index'])->middleware('abilities:read');
        Route::post('/transactions', [TransactionController::class, 'store'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::patch('/transactions/{transaction}', [TransactionController::class, 'update'])->middleware(['throttle:30,1', 'abilities:write']);
        Route::delete('/transactions/{transaction}', [TransactionController::class, 'destroy'])->middleware(['throttle:30,1', 'abilities:write']);
    });
});
