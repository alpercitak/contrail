import { DEFAULT_FLEET_SIZE, DEFAULT_TICK_MS } from '@contrail/shared';
import { upsertMarker } from './marker';
import { incrementUpdates, setStatus, updateAircraftCount } from './hud';

export const startDemo = async () => {
  const { FeedMock } = await import('@contrail/feed-mock');
  const feedMock = new FeedMock({ fleetSize: DEFAULT_FLEET_SIZE, tickMs: DEFAULT_TICK_MS });
  const flights = feedMock.snapshot();

  for (const flight of flights) {
    upsertMarker(flight);
  }

  setInterval(async () => {
    const events = await feedMock.fetch();
    for (const flight of events) {
      upsertMarker(flight);
      incrementUpdates(events.length);
    }
  }, DEFAULT_TICK_MS);

  setStatus('demo');
  updateAircraftCount(flights.length);
};
