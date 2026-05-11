import Fastify from 'fastify';
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';
import { REDIS_CHANNEL, REDIS_DEFAULT_URL, REDIS_FLIGHTS_KEY } from '@contrail/shared/constants';
import type { FlightEvent, GatewayMessage, BoundingBox } from '@contrail/shared/types';

const PORT = parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? REDIS_DEFAULT_URL;

const store = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

const clients = new Set<WebSocket>();
const clientViewports = new Map<WebSocket, BoundingBox>();

const isInViewport = (flight: FlightEvent, bbox: BoundingBox): boolean =>
  flight.lat >= bbox.latMin && flight.lat <= bbox.latMax && flight.lon >= bbox.lonMin && flight.lon <= bbox.lonMax;

const broadcastSnapshot = async () => {
  const raw = await store.hgetall(REDIS_FLIGHTS_KEY);
  const flights: Array<FlightEvent> = Object.values(raw).map((v) => JSON.parse(v));
  const payload = JSON.stringify({ type: 'snapshot', flights } satisfies GatewayMessage);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
  console.log(`[gateway] Snapshot broadcast — ${flights.length} aircraft`);
};

const broadcast = (flight: FlightEvent) => {
  const payload = JSON.stringify({ type: 'update', flight } satisfies GatewayMessage);
  for (const client of clients) {
    if (client.readyState !== 1) {
      continue;
    }
    const bbox = clientViewports.get(client);
    if (!bbox || isInViewport(flight, bbox)) {
      client.send(payload);
    }
  }
};

sub.subscribe(REDIS_CHANNEL, (err) => {
  if (err) {
    console.error('[gateway] Redis subscribe error', err);
    process.exit(1);
  }
  console.log(`[gateway] Subscribed to ${REDIS_CHANNEL}`);
});

sub.on('message', (_channel, message) => {
  try {
    const msg = JSON.parse(message);

    if (msg.type === 'reset') {
      broadcastSnapshot();
      return;
    }

    broadcast(msg as FlightEvent);
  } catch (err) {
    console.error('[gateway] Failed to parse event', err);
  }
});

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

app.get('/ws', { websocket: true }, async (socket) => {
  clients.add(socket);
  console.log(`[gateway] Client connected — total: ${clients.size}`);

  const raw = await store.hgetall(REDIS_FLIGHTS_KEY);
  const flights: FlightEvent[] = Object.values(raw).map((v) => JSON.parse(v));
  socket.send(JSON.stringify({ type: 'snapshot', flights } satisfies GatewayMessage));

  socket.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString()) as GatewayMessage;
      if (msg.type === 'viewport') {
        clientViewports.set(socket, msg.bbox);
      }
    } catch {}
  });

  socket.on('close', () => {
    clients.delete(socket);
    clientViewports.delete(socket);
    console.log(`[gateway] Client disconnected — total: ${clients.size}`);
  });

  socket.on('error', (err: Error) => {
    clients.delete(socket);
    clientViewports.delete(socket);
    console.error('[gateway] Socket error', err);
  });
});

app.get('/health', async () => ({ status: 'ok', clients: clients.size }));

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`[gateway] Listening on :${PORT}`);
