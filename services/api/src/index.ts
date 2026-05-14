import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import Redis from 'ioredis';
import {
  DEFAULT_REDIS_URL,
  REDIS_FLIGHT_KEY,
  REDIS_FLIGHT_CALLSIGNS_KEY,
  REDIS_FLIGHT_ICAO24S_KEY,
  REDIS_FLIGHT_BY_CALLSIGN_KEY,
  REDIS_FLIGHT_BY_ICAO24_KEY,
  REDIS_FLIGHTS_KEY,
} from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';
import { createLogger } from '@contrail/logger';

const logger = createLogger('api');

const PORT = Number.parseInt(process.env.PORT ?? '3002');
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
const SEARCH_LIMIT = 25;

const normalizeSearchValue = (value: string) => value.toLowerCase().trim();

const parseFlight = (value: string | null): FlightEvent | null => {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as FlightEvent;
};

const findIndexedFlight = async (icao24: string, query: string): Promise<FlightEvent | null> => {
  const flight = parseFlight(await redis.hget(REDIS_FLIGHTS_KEY, icao24));
  if (!flight) {
    return null;
  }

  const normalizedCallsign = normalizeSearchValue(flight.callsign);
  const normalizedIcao24 = normalizeSearchValue(flight.icao24);
  if (
    normalizedIcao24 === query ||
    normalizedCallsign === query ||
    normalizedIcao24.startsWith(query) ||
    normalizedCallsign.startsWith(query)
  ) {
    return flight;
  }

  return null;
};

const parseIndexMemberIcao24 = (member: string) => member.slice(member.lastIndexOf(':') + 1);

const firstMatchingFlight = async (icao24s: Array<string>, query: string): Promise<FlightEvent | null> => {
  const seen = new Set<string>();
  for (const icao24 of icao24s) {
    if (seen.has(icao24)) {
      continue;
    }
    seen.add(icao24);

    const flight = await findIndexedFlight(icao24, query);
    if (flight) {
      return flight;
    }
  }

  return null;
};

const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnect attempt');
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error({ err }, 'Redis connection error');
    return true;
  },
});

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

// GET /api/flights/search?q=CONTRAIL1111
app.get<{ Querystring: { q: string } }>('/api/flights/search', async (req, reply) => {
  const q = normalizeSearchValue(req.query.q ?? '');
  if (!q) {
    return reply.status(400).send({ error: 'missing query' });
  }

  const exactIcao24 = await redis.hget(REDIS_FLIGHT_BY_ICAO24_KEY, q);
  const exactCallsignIcao24 = await redis.hget(REDIS_FLIGHT_BY_CALLSIGN_KEY, q);
  const exactMatch = await firstMatchingFlight(
    [exactIcao24, exactCallsignIcao24].filter((icao24): icao24 is string => !!icao24),
    q,
  );
  if (exactMatch) {
    return reply.send(exactMatch);
  }

  const [icao24Matches, callsignMatches] = await Promise.all([
    redis.zrangebylex(REDIS_FLIGHT_ICAO24S_KEY, `[${q}`, `[${q}\xff`, 'LIMIT', 0, SEARCH_LIMIT),
    redis.zrangebylex(REDIS_FLIGHT_CALLSIGNS_KEY, `[${q}`, `[${q}\xff`, 'LIMIT', 0, SEARCH_LIMIT),
  ]);

  const match = await firstMatchingFlight([...icao24Matches, ...callsignMatches].map(parseIndexMemberIcao24), q);
  if (!match) {
    return reply.status(404).send({ error: 'not found' });
  }

  return reply.send(match);
});

// GET /flights/:icao24 — single aircraft
app.get<{ Params: { icao24: string } }>('/api/flights/:icao24', async (req, reply) => {
  const raw = await redis.hget(REDIS_FLIGHTS_KEY, req.params.icao24);
  if (!raw) {
    return reply.status(404).send({ error: 'not found' });
  }
  return reply.send(JSON.parse(raw) as FlightEvent);
});

app.get<{ Params: { icao24: string } }>('/api/flights/:icao24/history', async (req, reply) => {
  const raw = await redis.lrange(`${REDIS_FLIGHT_KEY}:history:${req.params.icao24}`, 0, -1);
  if (!raw.length) {
    return reply.status(404).send({ error: 'not found' });
  }
  const history = raw.map((v) => JSON.parse(v) as FlightEvent);
  return reply.send(history);
});

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: PORT, host: '0.0.0.0' });

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  await app.close();
  await redis.quit();
  logger.info('shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

redis.on('connect', () => logger.info('Redis connected'));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err) => logger.error(`Redis error: ${err}`));
redis.on('reconnecting', (time: number) => logger.warn({ time }, 'Redis reconnecting'));
redis.on('close', () => logger.warn('Redis connection closed'));
redis.on('end', () => logger.warn('Redis connection ended (no more reconnects)'));

logger.info(`Listening on :${PORT}`);
