import Redis from 'ioredis';
import {
  DEFAULT_FLEET_SIZE,
  DEFAULT_REDIS_URL,
  DEFAULT_TICK_MS,
  REDIS_CHANNEL,
  REDIS_FLIGHTS_KEY,
} from '@contrail/shared/constants';
import { SimulationEngine } from '@contrail/simulation';
import type { FlightEvent } from '@contrail/shared';

const FLEET_SIZE = Number.parseInt(process.env.FLEET_SIZE ?? DEFAULT_FLEET_SIZE);
const TICK_MS = Number.parseInt(process.env.TICK_MS ?? DEFAULT_TICK_MS);
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

  redis.on('connect', () => console.log('[simulator] Redis connected'));
  redis.on('error', (err) => console.error('[simulator] Redis error', err));

  await redis.del(REDIS_FLIGHTS_KEY);
  console.log('[simulator] Cleared previous fleet');

  await redis.publish(REDIS_CHANNEL, JSON.stringify({ type: 'reset' }));

  const engine = new SimulationEngine({ fleetSize: FLEET_SIZE, tickMs: TICK_MS });

  console.log(`[simulator] Fleet of ${FLEET_SIZE} aircraft spawned`);

  const tick = async () => {
    const events = engine.tick();
    const pipeline = redis.pipeline();

    for (const flight of events) {
      const serialized = JSON.stringify(flight);
      pipeline.hset(REDIS_FLIGHTS_KEY, flight.icao24, serialized);
      pipeline.publish(REDIS_CHANNEL, serialized);
    }

    await pipeline.exec();
    await cleanStaleFlights(redis);
    console.log(`[simulator] tick — ${events.length} aircraft`);
  };

  await tick();
  setInterval(tick, TICK_MS);
};

main().catch((err) => {
  console.error('[simulator] fatal', err);
  process.exit(1);
});
