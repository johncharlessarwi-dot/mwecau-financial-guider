import http from 'k6/http';
import { check, sleep } from 'k6';
const api = (__ENV.API_BASE_URL || '').replace(/\/$/, '');
const token = __ENV.API_TOKEN || '';
if (!api) throw new Error('Set API_BASE_URL to the staging API origin.');
export const options = {
  stages: [{ duration: '30s', target: 1 }, { duration: '60s', target: 3 }, { duration: '30s', target: 0 }],
  thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<1500'] },
};
export default function () {
  const health = http.get(api + '/api/v1/health', { tags: { endpoint: 'health' } });
  check(health, {
    'health endpoint returns 200': (r) => r.status === 200,
    'health payload reports ok': (r) => { try { return r.json('status') === 'ok'; } catch (_) { return false; } },
  });
  if (token) {
    const response = http.get(api + '/api/v1/transactions', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      tags: { endpoint: 'transactions-read' },
    });
    check(response, {
      'authenticated read is not a server error': (r) => r.status < 500,
      'authenticated read is not rate limited': (r) => r.status !== 429,
    });
  }
  sleep(5);
}
