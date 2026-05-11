import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import Redis from 'ioredis';
import { REDIS_CHANNEL, REDIS_DEFAULT_URL, REDIS_FLIGHTS_KEY } from '@contrail/shared/constants';
import type { FlightEvent, GatewayMessage, BoundingBox } from '@contrail/shared/types';

const PORT = parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? REDIS_DEFAULT_URL;

const store = new Redis(REDIS_URL); // for HGETALL / state reads
const sub = new Redis(REDIS_URL); // dedicated subscriber connection

const clients = new Set<import('@fastify/websocket').WebSocket>();
const clientViewports = new Map<WebSocket, BoundingBox>();

const isInViewport = (flight: FlightEvent, bbox: BoundingBox): boolean =>
  flight.lat >= bbox.latMin && flight.lat <= bbox.latMax && flight.lon >= bbox.lonMin && flight.lon <= bbox.lonMax;

const broadcast = (flight: FlightEvent) => {
  const payload = JSON.stringify({ type: 'update', flight });
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
    const flight = JSON.parse(message) as FlightEvent;
    broadcast(flight);
  } catch (err) {
    console.error('[gateway] Failed to parse event', err);
  }
});

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

app.get('/ws', { websocket: true }, async (socket) => {
  clients.add(socket);
  console.log(`[gateway] Client connected — total: ${clients.size}`);

  // Send current state snapshot immediately on connect
  const raw = await store.hgetall(REDIS_FLIGHTS_KEY);
  const flights: Array<FlightEvent> = Object.values(raw).map((v) => JSON.parse(v));

  const snapshot: GatewayMessage = { type: 'snapshot', flights };
  socket.send(JSON.stringify(snapshot));

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

await store.flushdb();
console.log(`[gateway] Redis database flushed (clean slate)`);

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`[gateway] Listening on :${PORT}`);
