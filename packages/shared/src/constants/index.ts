export const DEFAULT_REDIS_URL = 'redis://localhost:6379';
export const DEFAULT_FLEET_SIZE = 150;
export const DEFAULT_TICK_MS = 5000;
export const DEFAULT_BOUNDING_BOX = {
  latMin: 36.0,
  latMax: 71.0,
  lonMin: -10.0,
  lonMax: 30.0,
} as const;

export const REDIS_CHANNEL = 'flight-events';
export const REDIS_FLIGHTS_KEY = 'flights';
export const REDIS_FLIGHTS_BY_CALLSIGN_KEY = 'flight:by:callsign';
export const REDIS_FLIGHTS_BY_ICAO24_KEY = 'flight:by:icao24';
export const REDIS_FLIGHT_CALLSIGNS_KEY = 'flight:callsigns';
export const REDIS_FLIGHT_ICAO24S_KEY = 'flight:icao24s';
export const REDIS_FLIGHTS_LAST_SEEN_KEY = `${REDIS_FLIGHTS_KEY}:last-seen`;
