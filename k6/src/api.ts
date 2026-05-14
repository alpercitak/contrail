import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const apiSuccess = new Rate('api_success');
const apiLatency = new Trend('api_latency_ms');

const API_URL = __ENV.API_URL || 'http://localhost:3002';

export const apiFlow = () => {
  const start = Date.now();

  const healthRes = http.get(`${API_URL}/health`);

  const ok1 = check(healthRes, {
    'health 200': (r) => r.status === 200,
  });

  apiSuccess.add(ok1 ? 1 : 0);
  apiLatency.add(Date.now() - start);

  const res = http.get(`${API_URL}/api/flights`);

  const ok2 = check(res, {
    'flights 200': (r) => r.status === 200,
  });

  apiSuccess.add(ok2 ? 1 : 0);

  sleep(1);
};
