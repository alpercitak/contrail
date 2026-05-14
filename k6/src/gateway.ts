import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const snapshotReceived = new Counter('snapshot_received');
const updateReceived = new Counter('updates_received');
const snapshotDuration = new Trend('snapshot_duration_ms');
const connectionSuccess = new Rate('connection_success');

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws';

const VIEWPORT = ['v', [36.0, 71.0, -10.0, 30.0]] as const;

export function gatewayFlow() {
  const start = Date.now();

  const res = ws.connect(WS_URL, {}, (socket) => {
    connectionSuccess.add(1);

    socket.on('open', () => {
      socket.send(JSON.stringify(VIEWPORT));
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg[0] === 's') {
          snapshotReceived.add(1);
          snapshotDuration.add(Date.now() - start);

          check(msg, {
            'snapshot has flights': (m) => Array.isArray(m[1]),
            'snapshot not empty': (m) => m[1]?.length > 0,
          });
        }

        if (msg[0] === 'u') {
          updateReceived.add(1);

          check(msg, {
            'has icao24': (m) => !!m[1]?.[0],
            'has position': (m) => m[1]?.[2] != null && m[1]?.[3] != null,
          });
        }

        if (msg[0] === 'b') {
          updateReceived.add(msg[1]?.length ?? 0);

          check(msg, {
            'batch has flights': (m) => Array.isArray(m[1]),
            'batch entries have position': (m) => m[1]?.every((f) => f?.[2] != null && f?.[3] != null),
          });
        }
      } catch {}
    });

    socket.setTimeout(() => socket.close(), 120000);
  });

  check(res, { connected: (r) => r && r.status === 101 });
  sleep(1);
}
