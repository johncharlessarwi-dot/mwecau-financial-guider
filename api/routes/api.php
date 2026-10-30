<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
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

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/accounts', [AccountController::class, 'index']);
        Route::post('/accounts', [AccountController::class, 'store']);
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store'])->middleware('throttle:30,1');
        Route::patch('/categories/{category}', [CategoryController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware('throttle:30,1');\n        Route::get('/budgets', [BudgetController::class, 'index']);\n        Route::post('/budgets', [BudgetController::class, 'store'])->middleware('throttle:30,1');\n        Route::patch('/budgets/{budget}', [BudgetController::class, 'update'])->middleware('throttle:30,1');\n        Route::delete('/budgets/{budget}', [BudgetController::class, 'destroy'])->middleware('throttle:30,1');
        Route::post('/transfers', [TransferController::class, 'store']);
        Route::get('/transactions', [TransactionController::class, 'index']);
        Route::post('/transactions', [TransactionController::class, 'store']);
        Route::patch('/transactions/{transaction}', [TransactionController::class, 'update']);
        Route::delete('/transactions/{transaction}', [TransactionController::class, 'destroy']);
    });
});