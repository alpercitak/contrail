import Fastify from 'fastify';
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';
import { createLogger } from '@contrail/logger';
import { DEFAULT_REDIS_URL, REDIS_CHANNEL, REDIS_FLIGHTS_KEY } from '@contrail/shared/constants';
import type { FlightEvent, GatewayMessage, BoundingBox } from '@contrail/shared/types';

const logger = createLogger('gateway');

const PORT = Number.parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
const SNAPSHOT_TTL = 1000;
const MAX_BUFFERED_AMOUNT = 1_000_000;

const store = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

const clients = new Set<WebSocket>();
const clientViewports = new Map<WebSocket, BoundingBox>();

let cachedSnapshot: Array<FlightEvent> = [];
let lastSnapshot = 0;

const safeParse = (v: string): FlightEvent | null => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const getSnapshot = async (): Promise<Array<FlightEvent>> => {
  const now = Date.now();

  if (now - lastSnapshot < SNAPSHOT_TTL) {
    return cachedSnapshot;
  }

  const raw = await store.hgetall(REDIS_FLIGHTS_KEY);

  cachedSnapshot = Object.values(raw).map(safeParse).filter(Boolean) as Array<FlightEvent>;

  lastSnapshot = now;

  return cachedSnapshot;
};

const isInViewport = (flight: FlightEvent, bbox: BoundingBox): boolean =>
  flight.lat >= bbox.latMin && flight.lat <= bbox.latMax && flight.lon >= bbox.lonMin && flight.lon <= bbox.lonMax;

const broadcastSnapshot = async () => {
  const flights = await getSnapshot();
  const payload = JSON.stringify({ type: 'snapshot', flights } satisfies GatewayMessage);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
  logger.info(`Snapshot broadcast: ${flights.length} aircraft`);
};

const broadcast = (flight: FlightEvent) => {
  const payload = JSON.stringify({ type: 'update', flight } satisfies GatewayMessage);
  for (const client of clients) {
    if (client.readyState !== 1) {
      continue;
    }
    const bbox = clientViewports.get(client);
    if (bbox && !isInViewport(flight, bbox)) {
      continue;
    }
    if (client.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      logger.warn({ bufferedAmount: client.bufferedAmount }, 'Dropping slow client (backpressure exceeded)');
      clients.delete(client);
      clientViewports.delete(client);
      client.terminate();
      continue;
    }
    client.send(payload);
  }
};

sub.subscribe(REDIS_CHANNEL, (err) => {
  if (err) {
    logger.error(`[gateway] Redis subscribe error: ${err}`);
    process.exit(1);
  }
  logger.info(`Subscribed to ${REDIS_CHANNEL}`);
});

sub.on('message', (_channel, message) => {
  try {
    const msg = JSON.parse(message);

    if (msg.type === 'reset') {
      broadcastSnapshot().catch((err) => logger.error(`broadcastSnapshot error: ${err}`));
      return;
    }

    broadcast(msg as FlightEvent);
  } catch (err) {
    logger.error(`Failed to parse event: ${err}`);
  }
});

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

app.get('/ws', { websocket: true }, async (socket) => {
  clients.add(socket);
  logger.info(`Client connected | total: ${clients.size}`);

  const flights = await getSnapshot();
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
    logger.info(`Client disconnected | total: ${clients.size}`);
  });

  socket.on('error', (err: Error) => {
    clients.delete(socket);
    clientViewports.delete(socket);
    logger.error(`Socket error: ${err}`);
  });
});

app.get('/health', async () => ({ status: 'ok', clients: clients.size }));

await app.listen({ port: PORT, host: '0.0.0.0' });

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  for (const client of clients) client.close();
  await app.close();
  await store.quit();
  await sub.quit();
  logger.info('shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info(`Listening on :${PORT}`);
