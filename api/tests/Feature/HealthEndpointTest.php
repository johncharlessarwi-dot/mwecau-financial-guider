<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_endpoint_reports_service_status(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('service', 'MWECau GUIDER API')
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('version', 'v1');
    }
}