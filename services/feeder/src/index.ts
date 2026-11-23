import Redis from 'ioredis';
import { createLogger } from '@contrail/logger';
import {
  DEFAULT_FLEET_SIZE,
  DEFAULT_OPENSKY_TICK_MS,
  DEFAULT_REDIS_URL,
  DEFAULT_TICK_MS,
  REDIS_CHANNEL,
  REDIS_FLIGHT_BY_CALLSIGN_KEY,
  REDIS_FLIGHT_BY_ICAO24_KEY,
  REDIS_FLIGHT_CALLSIGNS_KEY,
  REDIS_FLIGHT_ICAO24S_KEY,
  REDIS_FLIGHT_KEY,
  REDIS_FLIGHTS_KEY,
  REDIS_FLIGHTS_LAST_SEEN_KEY,
} from '@contrail/shared/constants';
import type { Feed, FlightEvent, RemoveMessage } from '@contrail/shared/types';

const logger = createLogger('feeder');

const { OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET } = process.env;
const FLEET_SIZE = process.env.FLEET_SIZE ? Number.parseInt(process.env.FLEET_SIZE, 10) : DEFAULT_FLEET_SIZE;
const DEFAULT_FEED_TICK_MS = OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET ? DEFAULT_OPENSKY_TICK_MS : DEFAULT_TICK_MS;
const TICK_MS = process.env.TICK_MS ? Number.parseInt(process.env.TICK_MS, 10) : DEFAULT_FEED_TICK_MS;
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
const STALE_MS = TICK_MS * 3;
const CLEANUP_BATCH_SIZE = 500;

const normalizeSearchValue = (value: string) => value.toLowerCase().trim();

const callsignIndexMember = (flight: FlightEvent) => `${normalizeSearchValue(flight.callsign)}:${flight.icao24}`;
const icao24IndexMember = (flight: FlightEvent) => `${normalizeSearchValue(flight.icao24)}:${flight.icao24}`;
const historyKey = (icao24: string) => `${REDIS_FLIGHT_KEY}:history:${icao24}`;

// Several aircraft can share a callsign; only drop a mapping that still points at the aircraft giving it up.
// The feeder is the only writer, so reading before deleting is race-free.
const removeCallsignMappings = async (redis: Redis, flights: Array<FlightEvent>) => {
  if (flights.length === 0) {
    return;
  }
  const callsigns = flights.map((flight) => normalizeSearchValue(flight.callsign));
  const owners = await redis.hmget(REDIS_FLIGHT_BY_CALLSIGN_KEY, ...callsigns);
  const owned = callsigns.filter((_, i) => owners[i] === flights[i].icao24);
  if (owned.length > 0) {
    await redis.hdel(REDIS_FLIGHT_BY_CALLSIGN_KEY, ...owned);
  }
};

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
    pipeline.zrem(REDIS_FLIGHT_CALLSIGNS_KEY, ...staleFlights.map(callsignIndexMember));
    pipeline.zrem(REDIS_FLIGHT_ICAO24S_KEY, ...staleFlights.map(icao24IndexMember));
  }
  pipeline.zrem(REDIS_FLIGHTS_LAST_SEEN_KEY, ...staleIcao24s);
  pipeline.del(...staleIcao24s.map(historyKey));
  pipeline.publish(REDIS_CHANNEL, JSON.stringify({ type: 'remove', icao24s: staleIcao24s } satisfies RemoveMessage));
  await pipeline.exec();
  await removeCallsignMappings(redis, staleFlights);
};

const createFeed = async (): Promise<Feed> => {
  if (OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET) {
    const { FeedOpenSky } = await import('@contrail/feed-opensky');
    return new FeedOpenSky({
      clientId: OPENSKY_CLIENT_ID,
      clientSecret: OPENSKY_CLIENT_SECRET,
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
  let tickTimer: NodeJS.Timeout;

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('ready', () => logger.info('Redis ready'));
  redis.on('error', (err) => logger.error(`Redis error: ${err}`));
  redis.on('reconnecting', (time: number) => logger.warn({ time }, 'Redis reconnecting'));
  redis.on('close', () => logger.warn('Redis connection closed'));
  redis.on('end', () => logger.warn('Redis connection ended (no more reconnects)'));

  const feed = await createFeed();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    clearTimeout(tickTimer);
    await redis.quit();
    logger.info('shutdown complete');
    process.exit(0);
  };

  const tick = async () => {
    let events: Array<FlightEvent> | undefined;

    try {
      events = await feed.fetch();
    } catch (err) {
      logger.warn(`Error fetching events: ${err}`);
    }

    if (!events?.length) {
      return;
    }

    const seenAt = Date.now();
    const previous = await redis.hmget(REDIS_FLIGHTS_KEY, ...events.map((flight) => flight.icao24));
    const renamed: Array<FlightEvent> = [];
    const pipeline = redis.pipeline();

    for (const [i, flight] of events.entries()) {
      const prevRaw = previous[i];
      const prev = prevRaw ? (JSON.parse(prevRaw) as FlightEvent) : null;
      if (prev && prev.callsign !== flight.callsign) {
        renamed.push(prev);
        pipeline.zrem(REDIS_FLIGHT_CALLSIGNS_KEY, callsignIndexMember(prev));
      }

      const serialized = JSON.stringify(flight);
      pipeline.hset(REDIS_FLIGHTS_KEY, flight.icao24, serialized);
      pipeline.hset(REDIS_FLIGHT_BY_ICAO24_KEY, normalizeSearchValue(flight.icao24), flight.icao24);
      pipeline.hset(REDIS_FLIGHT_BY_CALLSIGN_KEY, normalizeSearchValue(flight.callsign), flight.icao24);
      pipeline.zadd(REDIS_FLIGHT_ICAO24S_KEY, 0, icao24IndexMember(flight));
      pipeline.zadd(REDIS_FLIGHT_CALLSIGNS_KEY, 0, callsignIndexMember(flight));
      pipeline.zadd(REDIS_FLIGHTS_LAST_SEEN_KEY, seenAt, flight.icao24);
      pipeline.publish(REDIS_CHANNEL, serialized);
      pipeline.lpush(historyKey(flight.icao24), serialized);
      pipeline.ltrim(historyKey(flight.icao24), 0, 49);
    }

    await pipeline.exec();
    await removeCallsignMappings(redis, renamed);
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

  // Chained timeouts so a slow fetch never overlaps the next tick.
  const loop = async () => {
    const startedAt = Date.now();
    await tick().catch((err) => logger.error(`Tick failed: ${err}`));
    tickTimer = setTimeout(loop, Math.max(0, TICK_MS - (Date.now() - startedAt)));
  };
  tickTimer = setTimeout(loop, TICK_MS);

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
