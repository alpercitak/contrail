import Redis from 'ioredis';
import { REDIS_CHANNEL, REDIS_FLIGHTS_KEY } from '@contrail/shared/constants';
import { FLEET_SIZE, REDIS_URL, TICK_MS } from './constants';
import { SimulationEngine } from '@contrail/simulation';

const main = async () => {
  const redis = new Redis(REDIS_URL);

  redis.on('connect', () => console.log('[simulator] Redis connected'));
  redis.on('error', (err) => console.error('[simulator] Redis error', err));

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
    console.log(`[simulator] tick — ${events.length} aircraft`);
  };

  await tick();
  setInterval(tick, TICK_MS);
};

main().catch((err) => {
  console.error('[simulator] fatal', err);
  process.exit(1);
});
