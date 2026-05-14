import Redis from 'ioredis';
import { createLogger } from '@contrail/logger';
import {
  DEFAULT_FLEET_SIZE,
  DEFAULT_REDIS_URL,
  DEFAULT_TICK_MS,
  REDIS_CHANNEL,
  REDIS_FLIGHTS_KEY,
} from '@contrail/shared/constants';
import type { Feed, FlightEvent } from '@contrail/shared/types';

const logger = createLogger('feeder');

const FLEET_SIZE = process.env.FLEET_SIZE ? Number.parseInt(process.env.FLEET_SIZE) : DEFAULT_FLEET_SIZE;
const TICK_MS = process.env.TICK_MS ? Number.parseInt(process.env.TICK_MS) : DEFAULT_TICK_MS;
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
const REDIS_FLIGHTS_LAST_SEEN_KEY = `${REDIS_FLIGHTS_KEY}:last-seen`;
const STALE_MS = TICK_MS * 3;
const CLEANUP_BATCH_SIZE = 500;

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

  const pipeline = redis.pipeline();
  pipeline.hdel(REDIS_FLIGHTS_KEY, ...staleIcao24s);
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
      pipeline.zadd(REDIS_FLIGHTS_LAST_SEEN_KEY, flight.timestamp ?? Date.now(), flight.icao24);
      pipeline.publish(REDIS_CHANNEL, serialized);
      pipeline.lpush(`flight:history:${flight.icao24}`, serialized);
      pipeline.ltrim(`flight:history:${flight.icao24}`, 0, 49);
    }

    await pipeline.exec();
    await cleanStaleFlights(redis);
    logger.info(`Tick: ${events.length} aircraft`);
  };

  await redis.del(REDIS_FLIGHTS_KEY, REDIS_FLIGHTS_LAST_SEEN_KEY);
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
