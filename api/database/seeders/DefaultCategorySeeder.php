<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class DefaultCategorySeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'expense' => ['Food', 'Housing', 'Transport', 'Utilities', 'Healthcare', 'Education', 'Shopping', 'Entertainment', 'Personal Care', 'Other'],
            'income' => ['Salary', 'Business', 'Freelance', 'Investment', 'Gift', 'Other'],
        ];

        foreach ($defaults as $type => $names) {
            foreach ($names as $name) {
                Category::query()->firstOrCreate(
                    ['user_id' => null, 'type' => $type, 'name' => $name],
                    ['is_system' => true, 'is_active' => true],
                );
            }
        }
    }
}