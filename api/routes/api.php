<?php

use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'service' => 'MWECau GUIDER API',
            'status' => 'ok',
            'version' => 'v1',
        ]);
    });
});