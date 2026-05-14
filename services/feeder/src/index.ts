import Redis from 'ioredis';
import { createLogger } from '@contrail/logger';
import {
  DEFAULT_FLEET_SIZE,
  DEFAULT_REDIS_URL,
  DEFAULT_TICK_MS,
  REDIS_CHANNEL,
  REDIS_FLIGHT_KEY,
  REDIS_FLIGHT_CALLSIGNS_KEY,
  REDIS_FLIGHT_ICAO24S_KEY,
  REDIS_FLIGHT_BY_CALLSIGN_KEY,
  REDIS_FLIGHT_BY_ICAO24_KEY,
  REDIS_FLIGHTS_KEY,
  REDIS_FLIGHTS_LAST_SEEN_KEY,
} from '@contrail/shared/constants';
import type { Feed, FlightEvent } from '@contrail/shared/types';

const logger = createLogger('feeder');

const FLEET_SIZE = process.env.FLEET_SIZE ? Number.parseInt(process.env.FLEET_SIZE) : DEFAULT_FLEET_SIZE;
const TICK_MS = process.env.TICK_MS ? Number.parseInt(process.env.TICK_MS) : DEFAULT_TICK_MS;
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
const STALE_MS = TICK_MS * 3;
const CLEANUP_BATCH_SIZE = 500;

const normalizeSearchValue = (value: string) => value.toLowerCase().trim();

const callsignIndexMember = (flight: FlightEvent) => `${normalizeSearchValue(flight.callsign)}:${flight.icao24}`;
const icao24IndexMember = (flight: FlightEvent) => `${normalizeSearchValue(flight.icao24)}:${flight.icao24}`;

const cleanStaleFlights = async (redis: Redis) => {
  const staleBefore = Date.now() - STALE_MS;
  const staleIcao24s = await redis.zrangebyscore(
    REDIS_FLIGHTS_LAST_SEEN_KEY,
    '-inf',
    staleBefore,
    'LIMIT',
    0,
    CLEANUP_BATCH_SIZE,
  );

  if (staleIcao24s.length === 0) {
    return;
  }

  const staleFlights = (await redis.hmget(REDIS_FLIGHTS_KEY, ...staleIcao24s))
    .filter((value): value is string => value !== null)
    .map((value) => JSON.parse(value) as FlightEvent);

  const pipeline = redis.pipeline();
  pipeline.hdel(REDIS_FLIGHTS_KEY, ...staleIcao24s);
  pipeline.hdel(REDIS_FLIGHT_BY_ICAO24_KEY, ...staleIcao24s.map(normalizeSearchValue));
  if (staleFlights.length > 0) {
    pipeline.hdel(REDIS_FLIGHT_BY_CALLSIGN_KEY, ...staleFlights.map((flight) => normalizeSearchValue(flight.callsign)));
    pipeline.zrem(REDIS_FLIGHT_CALLSIGNS_KEY, ...staleFlights.map(callsignIndexMember));
    pipeline.zrem(REDIS_FLIGHT_ICAO24S_KEY, ...staleFlights.map(icao24IndexMember));
  }
  pipeline.zrem(REDIS_FLIGHTS_LAST_SEEN_KEY, ...staleIcao24s);
  await pipeline.exec();
};

const createFeed = async (): Promise<Feed> => {
  if (process.env.OPENSKY_CLIENT_ID) {
    const { FeedOpenSky } = await import('@contrail/feed-opensky');
    return new FeedOpenSky({
      clientId: process.env.OPENSKY_CLIENT_ID!,
      clientSecret: process.env.OPENSKY_CLIENT_SECRET!,
      tickMs: DEFAULT_TICK_MS,
    });
  }

  const { FeedMock } = await import('@contrail/feed-mock');

  return new FeedMock({
    fleetSize: FLEET_SIZE,
    tickMs: TICK_MS,
  });
};

const main = async () => {
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
  let tickInterval: NodeJS.Timeout;

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('ready', () => logger.info('Redis ready'));
  redis.on('error', (err) => logger.error(`Redis error: ${err}`));
  redis.on('reconnecting', (time: number) => logger.warn({ time }, 'Redis reconnecting'));
  redis.on('close', () => logger.warn('Redis connection closed'));
  redis.on('end', () => logger.warn('Redis connection ended (no more reconnects)'));

  const feed = await createFeed();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(tickInterval);
    await redis.quit();
    logger.info('shutdown complete');
    process.exit(0);
  };

  const tick = async () => {
    const events = await feed.fetch();
    const pipeline = redis.pipeline();

    for (const flight of events) {
      const serialized = JSON.stringify(flight);
      pipeline.hset(REDIS_FLIGHTS_KEY, flight.icao24, serialized);
      pipeline.hset(REDIS_FLIGHT_BY_ICAO24_KEY, normalizeSearchValue(flight.icao24), flight.icao24);
      pipeline.hset(REDIS_FLIGHT_BY_CALLSIGN_KEY, normalizeSearchValue(flight.callsign), flight.icao24);
      pipeline.zadd(REDIS_FLIGHT_ICAO24S_KEY, 0, icao24IndexMember(flight));
      pipeline.zadd(REDIS_FLIGHT_CALLSIGNS_KEY, 0, callsignIndexMember(flight));
      pipeline.zadd(REDIS_FLIGHTS_LAST_SEEN_KEY, flight.timestamp ?? Date.now(), flight.icao24);
      pipeline.publish(REDIS_CHANNEL, serialized);
      pipeline.lpush(`${REDIS_FLIGHT_KEY}:history:${flight.icao24}`, serialized);
      pipeline.ltrim(`${REDIS_FLIGHT_KEY}:history:${flight.icao24}`, 0, 49);
    }

    await pipeline.exec();
    await cleanStaleFlights(redis);
    logger.info(`Tick: ${events.length} aircraft`);
  };

  await redis.del(
    REDIS_FLIGHTS_KEY,
    REDIS_FLIGHTS_LAST_SEEN_KEY,
    REDIS_FLIGHT_BY_CALLSIGN_KEY,
    REDIS_FLIGHT_BY_ICAO24_KEY,
    REDIS_FLIGHT_CALLSIGNS_KEY,
    REDIS_FLIGHT_ICAO24S_KEY,
  );
  logger.info('Cleared previous fleet');
  await tick();
  await redis.publish(REDIS_CHANNEL, JSON.stringify({ type: 'reset' }));
  tickInterval = setInterval(tick, TICK_MS);

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
