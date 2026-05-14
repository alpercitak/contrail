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
export const REDIS_FLIGHT_KEY = 'flight';
export const REDIS_FLIGHT_CALLSIGNS_KEY = `${REDIS_FLIGHT_KEY}:callsigns`;
export const REDIS_FLIGHT_ICAO24S_KEY = `${REDIS_FLIGHT_KEY}:icao24s`;
export const REDIS_FLIGHT_BY_CALLSIGN_KEY = `${REDIS_FLIGHT_KEY}:by:callsign`;
export const REDIS_FLIGHT_BY_ICAO24_KEY = `${REDIS_FLIGHT_KEY}:by:icao24`;
export const REDIS_FLIGHTS_KEY = 'flights';
export const REDIS_FLIGHTS_LAST_SEEN_KEY = `${REDIS_FLIGHTS_KEY}:last-seen`;
