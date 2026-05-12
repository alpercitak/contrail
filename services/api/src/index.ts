import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import Redis from 'ioredis';
import { DEFAULT_REDIS_URL, REDIS_FLIGHTS_KEY } from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';
import { createLogger } from '@contrail/logger';

const logger = createLogger('api');

const PORT = Number.parseInt(process.env.PORT ?? '3002');
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

const redis = new Redis(REDIS_URL);

const app = Fastify({ logger: false });

await app.register(fastifyCors, {
  origin: true,
});

// GET /flights — all current aircraft state
app.get('/api/flights', async (_req, reply) => {
  const raw = await redis.hgetall(REDIS_FLIGHTS_KEY);
  const flights: FlightEvent[] = Object.values(raw).map((v) => JSON.parse(v));
  return reply.send(flights);
});

// GET /flights/:icao24 — single aircraft
app.get<{ Params: { icao24: string } }>('/api/flights/:icao24', async (req, reply) => {
  const raw = await redis.hget(REDIS_FLIGHTS_KEY, req.params.icao24);
  if (!raw) {
    return reply.status(404).send({ error: 'not found' });
  }
  return reply.send(JSON.parse(raw) as FlightEvent);
});

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: PORT, host: '0.0.0.0' });
logger.info(`Listening on :${PORT}`);
