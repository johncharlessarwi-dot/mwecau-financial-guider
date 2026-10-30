<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->restrictOnDelete();
            $table->enum('type', ['income', 'expense']);
            $table->decimal('amount', 18, 2);
            $table->char('currency', 3)->default('TZS');
            $table->string('category', 60)->default('Other');
            $table->string('description', 180);
            $table->timestamp('occurred_at');
            $table->string('reference', 80)->nullable();
            $table->enum('status', ['confirmed', 'draft'])->default('confirmed');
            $table->timestamps();
            $table->index(['user_id', 'occurred_at']);
            $table->index(['account_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};