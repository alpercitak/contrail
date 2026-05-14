import { DEFAULT_FLEET_SIZE, DEFAULT_TICK_MS } from '@contrail/shared';
import { upsertFlight } from './marker';
import { addTrailPoint } from './trail';
import { incrementUpdates, setStatus } from './hud';

export const startDemo = async () => {
  const { FeedMock } = await import('@contrail/feed-mock');
  const feed = new FeedMock({ fleetSize: DEFAULT_FLEET_SIZE, tickMs: DEFAULT_TICK_MS });

  for (const flight of feed.snapshot()) {
    upsertFlight(flight);
    addTrailPoint(flight.icao24, flight.lon, flight.lat);
  }

  setInterval(async () => {
    const events = await feed.fetch();
    for (const flight of events) {
      upsertFlight(flight);
      addTrailPoint(flight.icao24, flight.lon, flight.lat);
    }
    incrementUpdates(events.length);
  }, DEFAULT_TICK_MS);

  setStatus('online');
};
