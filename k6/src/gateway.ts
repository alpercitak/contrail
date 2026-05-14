import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const snapshotReceived = new Counter('snapshot_received');
const updateReceived = new Counter('updates_received');
const snapshotDuration = new Trend('snapshot_duration_ms');
const connectionSuccess = new Rate('connection_success');

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws';

const VIEWPORT = {
  type: 'viewport',
  bbox: { latMin: 36.0, latMax: 71.0, lonMin: -10.0, lonMax: 30.0 },
};

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

        if (msg.type === 'snapshot') {
          snapshotReceived.add(1);
          snapshotDuration.add(Date.now() - start);

          check(msg, {
            'snapshot has flights': (m) => Array.isArray(m.flights),
            'snapshot not empty': (m) => m.flights?.length > 0,
          });
        }

        if (msg.type === 'update') {
          updateReceived.add(1);

          check(msg, {
            'has icao24': (m) => !!m.flight?.icao24,
            'has position': (m) => m.flight?.lat != null && m.flight?.lon != null,
          });
        }
      } catch {}
    });

    socket.setTimeout(() => socket.close(), 120000);
  });

  check(res, { connected: (r) => r && r.status === 101 });
  sleep(1);
}
