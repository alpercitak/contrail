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
const BATCH_INTERVAL_MS = 100;
const MAX_BATCH_SIZE = 100;
const GRID_SIZE = 5;

const store = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

const regionClients = new Map<string, Set<WebSocket>>();
const clientRegions = new Map<WebSocket, Set<string>>();
const clientViewports = new Map<WebSocket, BoundingBox>();
const pendingUpdates = new Map<string, FlightEvent>();

let cachedSnapshot: Array<FlightEvent> = [];
let lastSnapshot = 0;
let batchTimer: NodeJS.Timeout;

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

const inViewport = (flight: FlightEvent, bbox: BoundingBox): boolean =>
  flight.lat >= bbox.latMin && flight.lat <= bbox.latMax && flight.lon >= bbox.lonMin && flight.lon <= bbox.lonMax;

const sendSnapshot = async (client: WebSocket, bbox: BoundingBox) => {
  const snapshot = await getSnapshot();
  const flights = snapshot.filter((flight) => inViewport(flight, bbox));
  if (client.readyState !== 1) {
    return;
  }
  client.send(JSON.stringify({ type: 'snapshot', flights } satisfies GatewayMessage));
};

const getCellId = (lat: number, lon: number) => `${Math.floor(lon / GRID_SIZE)}:${Math.floor(lat / GRID_SIZE)}`;

const getCellsForBBox = (bbox: BoundingBox) => {
  const cells: Array<string> = [];

  const minX = Math.floor(bbox.lonMin / GRID_SIZE);
  const maxX = Math.floor(bbox.lonMax / GRID_SIZE);
  const minY = Math.floor(bbox.latMin / GRID_SIZE);
  const maxY = Math.floor(bbox.latMax / GRID_SIZE);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      cells.push(`${x}:${y}`);
    }
  }

  return cells;
};

const registerClient = (client: WebSocket, bbox: BoundingBox) => {
  removeClient(client);
  const cells = getCellsForBBox(bbox);

  const set = new Set<string>();
  clientRegions.set(client, set);
  clientViewports.set(client, bbox);

  for (const cell of cells) {
    set.add(cell);

    if (!regionClients.has(cell)) {
      regionClients.set(cell, new Set());
    }

    regionClients.get(cell)!.add(client);
  }
};

const removeClient = (client: WebSocket) => {
  const regions = clientRegions.get(client);

  if (regions) {
    for (const cell of regions) {
      regionClients.get(cell)?.delete(client);
    }
  }

  clientRegions.delete(client);
  clientViewports.delete(client);
};

const sendBatch = (batch: Array<FlightEvent>) => {
  const grouped = new Map<string, Array<FlightEvent>>();

  for (const flight of batch) {
    const cell = getCellId(flight.lat, flight.lon);

    if (!grouped.has(cell)) {
      grouped.set(cell, []);
    }

    grouped.get(cell)!.push(flight);
  }

  for (const [cell, flights] of grouped) {
    const clients = regionClients.get(cell);
    if (!clients) {
      continue;
    }

    const payload = JSON.stringify({
      type: 'batch',
      flights,
    } satisfies GatewayMessage);

    for (const client of clients) {
      if (client.readyState !== 1) {
        continue;
      }

      if (client.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        client.terminate();
        removeClient(client);
        continue;
      }

      client.send(payload);
    }
  }
};

const flushBatch = () => {
  while (pendingUpdates.size > 0) {
    const batch: Array<FlightEvent> = [];

    for (const flight of pendingUpdates.values()) {
      batch.push(flight);
      pendingUpdates.delete(flight.icao24);

      if (batch.length >= MAX_BATCH_SIZE) {
        break;
      }
    }

    sendBatch(batch);
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
      return;
    }
    const flight = msg as FlightEvent;
    pendingUpdates.set(flight.icao24, flight);
  } catch (err) {
    logger.error(`Failed to parse event: ${err}`);
  }
});

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

app.get('/ws', { websocket: true }, async (socket) => {
  logger.info(`Client connected`);

  socket.on('message', (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString()) as GatewayMessage;
      if (msg.type === 'viewport') {
        registerClient(socket, msg.bbox);
        sendSnapshot(socket, msg.bbox).catch((err) => {
          logger.error(`Failed to send viewport snapshot: ${err}`);
        });
      }
    } catch {}
  });

  socket.on('close', () => {
    removeClient(socket);
  });

  socket.on('error', () => {
    removeClient(socket);
  });
});

app.get('/health', async () => ({ status: 'ok', clients: regionClients.size }));

await app.listen({ port: PORT, host: '0.0.0.0' });

batchTimer = setInterval(flushBatch, BATCH_INTERVAL_MS);

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  clearInterval(batchTimer);
  for (const set of regionClients.values()) {
    for (const client of set) {
      client.close();
    }
  }
  await app.close();
  await store.quit();
  await sub.quit();
  logger.info('shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info(`Listening on :${PORT}`);
