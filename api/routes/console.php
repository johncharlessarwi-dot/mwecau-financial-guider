<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('guider:about', function () {
    $this->comment('MWECau GUIDER API — personal finance platform.');
})->purpose('Display MWECau GUIDER API information');