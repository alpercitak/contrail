import Redis from 'ioredis';
import { FeedMock } from '@contrail/feed-mock';
import { createLogger } from '@contrail/logger';
import {
  DEFAULT_FLEET_SIZE,
  DEFAULT_REDIS_URL,
  DEFAULT_TICK_MS,
  REDIS_CHANNEL,
  REDIS_FLIGHTS_KEY,
} from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';

const logger = createLogger('feeder');

const FLEET_SIZE = process.env.FLEET_SIZE ? Number.parseInt(process.env.FLEET_SIZE) : DEFAULT_FLEET_SIZE;
const TICK_MS = process.env.TICK_MS ? Number.parseInt(process.env.TICK_MS) : DEFAULT_TICK_MS;
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

const cleanStaleFlights = async (redis: Redis) => {
  const raw = await redis.hgetall(REDIS_FLIGHTS_KEY);
  const now = Date.now();
  const staleMs = TICK_MS * 3;

  const pipeline = redis.pipeline();
  for (const [icao24, value] of Object.entries(raw)) {
    const flight = JSON.parse(value) as FlightEvent;
    if (now - flight.timestamp! > staleMs) {
      pipeline.hdel(REDIS_FLIGHTS_KEY, icao24);
    }
  }
  await pipeline.exec();
};

const main = async () => {
  const redis = new Redis(REDIS_URL);

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error(`Redis error: ${err}`));

  await redis.del(REDIS_FLIGHTS_KEY);
  logger.info('Cleared previous fleet');

  await redis.publish(REDIS_CHANNEL, JSON.stringify({ type: 'reset' }));

  const feedMock = new FeedMock({ fleetSize: FLEET_SIZE, tickMs: TICK_MS });

  for (const flight of feedMock.snapshot()) {
    await redis.hset(REDIS_FLIGHTS_KEY, flight.icao24, JSON.stringify(flight));
  }

  logger.info(`Fleet of ${FLEET_SIZE} aircraft spawned`);

  const tick = async () => {
    const events = await feedMock.fetch();
    const pipeline = redis.pipeline();

    for (const flight of events) {
      const serialized = JSON.stringify(flight);
      pipeline.hset(REDIS_FLIGHTS_KEY, flight.icao24, serialized);
      pipeline.publish(REDIS_CHANNEL, serialized);
    }

    await pipeline.exec();
    await cleanStaleFlights(redis);
    logger.info(`Tick: ${events.length} aircraft`);
  };

  await tick();
  setInterval(tick, TICK_MS);
};

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
