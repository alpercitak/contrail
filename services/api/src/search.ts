import type Redis from 'ioredis';
import {
  REDIS_FLIGHT_BY_CALLSIGN_KEY,
  REDIS_FLIGHT_BY_ICAO24_KEY,
  REDIS_FLIGHT_CALLSIGNS_KEY,
  REDIS_FLIGHT_ICAO24S_KEY,
  REDIS_FLIGHTS_KEY,
} from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';

const SEARCH_LIMIT = 25;

export const normalizeSearchValue = (value: string) => value.toLowerCase().trim();

const parseFlight = (value: string | null): FlightEvent | null => {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as FlightEvent;
};

const findIndexedFlight = async (redis: Redis, icao24: string, query: string): Promise<FlightEvent | null> => {
  const flight = parseFlight(await redis.hget(REDIS_FLIGHTS_KEY, icao24));
  if (!flight) {
    return null;
  }

  const normalizedCallsign = normalizeSearchValue(flight.callsign);
  const normalizedIcao24 = normalizeSearchValue(flight.icao24);
  if (
    normalizedIcao24 === query ||
    normalizedCallsign === query ||
    normalizedIcao24.startsWith(query) ||
    normalizedCallsign.startsWith(query)
  ) {
    return flight;
  }

  return null;
};

const parseIndexMemberIcao24 = (member: string) => member.slice(member.lastIndexOf(':') + 1);

const firstMatchingFlight = async (
  redis: Redis,
  icao24s: Array<string>,
  query: string,
): Promise<FlightEvent | null> => {
  const seen = new Set<string>();
  for (const icao24 of icao24s) {
    if (seen.has(icao24)) {
      continue;
    }
    seen.add(icao24);

    const flight = await findIndexedFlight(redis, icao24, query);
    if (flight) {
      return flight;
    }
  }

  return null;
};

// Exact icao24/callsign lookups first, then prefix matches from the sorted-set indexes. `query` must be normalized.
export const searchFlight = async (redis: Redis, query: string): Promise<FlightEvent | null> => {
  const exactIcao24 = await redis.hget(REDIS_FLIGHT_BY_ICAO24_KEY, query);
  const exactCallsignIcao24 = await redis.hget(REDIS_FLIGHT_BY_CALLSIGN_KEY, query);
  const exactMatch = await firstMatchingFlight(
    redis,
    [exactIcao24, exactCallsignIcao24].filter((icao24): icao24 is string => !!icao24),
    query,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const [icao24Matches, callsignMatches] = await Promise.all([
    redis.zrangebylex(REDIS_FLIGHT_ICAO24S_KEY, `[${query}`, `[${query}\xff`, 'LIMIT', 0, SEARCH_LIMIT),
    redis.zrangebylex(REDIS_FLIGHT_CALLSIGNS_KEY, `[${query}`, `[${query}\xff`, 'LIMIT', 0, SEARCH_LIMIT),
  ]);

  return firstMatchingFlight(redis, [...icao24Matches, ...callsignMatches].map(parseIndexMemberIcao24), query);
};
