import { gatewayFlow } from './gateway.js';
import { apiFlow } from './api.js';

const RUN_GATEWAY = __ENV.RUN_GATEWAY === 'true';
const RUN_API = __ENV.RUN_API === 'true';

export const options = {
  scenarios: {
    ...(RUN_GATEWAY
      ? {
          ws_connections: {
            executor: 'ramping-vus',
            exec: 'gatewayFlow',
            startVUs: 0,
            stages: [
              { duration: '30s', target: 50 },
              { duration: '60s', target: 100 },
              { duration: '30s', target: 0 },
            ],
          },
        }
      : {}),
    ...(RUN_API
      ? {
          api_load: {
            executor: 'ramping-vus',
            exec: 'apiFlow',
            startVUs: 0,
            stages: [
              { duration: '30s', target: 20 },
              { duration: '60s', target: 50 },
              { duration: '30s', target: 0 },
            ],
          },
        }
      : {}),
  },
  thresholds: {
    api_success: ['rate>0.99'],
  },
};

export { gatewayFlow, apiFlow };
