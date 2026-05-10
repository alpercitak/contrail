import Redis from 'ioredis';
import { REDIS_CHANNEL, REDIS_FLIGHTS_KEY } from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';
import { FLEET_SIZE, REDIS_URL, TICK_MS } from './constants';
import { spawnAircraft, tickAircraft, toFlightEvent } from './utils';

const main = async () => {
  const redis = new Redis(REDIS_URL);

  redis.on('connect', () => console.log('[simulator] Redis connected'));
  redis.on('error', (err) => console.error('[simulator] Redis error', err));

  // Spawn initial fleet
  const fleet = new Map<string, FlightEvent>();
  for (let i = 0; i < FLEET_SIZE; i++) {
    const ac = spawnAircraft();
    fleet.set(ac.icao24, ac);
  }

  console.log(`[simulator] Fleet of ${FLEET_SIZE} aircraft spawned`);

  async function tick() {
    const pipeline = redis.pipeline();

    for (const [icao24, ac] of fleet) {
      const updated = tickAircraft(ac);
      fleet.set(icao24, updated);

      const event = toFlightEvent(updated);
      const serialized = JSON.stringify(event);

      // Update current state in Redis hash
      pipeline.hset(REDIS_FLIGHTS_KEY, icao24, serialized);
      // Broadcast event to subscribers
      pipeline.publish(REDIS_CHANNEL, serialized);
    }

    await pipeline.exec();
    console.log(`[simulator] tick — ${fleet.size} aircraft`);
  }

  // Initial tick immediately, then on interval
  await tick();
  setInterval(tick, TICK_MS);
};

main().catch((err) => {
  console.error('[simulator] fatal', err);
  process.exit(1);
});
