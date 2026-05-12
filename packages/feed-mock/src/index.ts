import type { Feed, FlightEvent } from '@contrail/shared/types';
import type { FeedMockConfig } from './types';
import { spawnFleet, tickAircraft, toFlightEvent } from './utils/fleet';

export class FeedMock implements Feed {
  private fleet: Map<string, FlightEvent>;
  private config: FeedMockConfig;

  constructor(config: FeedMockConfig) {
    this.config = config;
    this.fleet = spawnFleet(config.fleetSize);
  }

  // Advance all aircraft by one tick
  tick(): Array<FlightEvent> {
    const events: Array<FlightEvent> = [];

    for (const [icao24, ac] of this.fleet) {
      const updated = tickAircraft(ac, this.config.tickMs);
      this.fleet.set(icao24, updated);
      events.push(toFlightEvent(updated));
    }

    return events;
  }

  // Current snapshot
  snapshot(): Array<FlightEvent> {
    return Array.from(this.fleet.values()).map(toFlightEvent);
  }

  async fetch(): Promise<Array<FlightEvent>> {
    return this.tick();
  }
}
