import Redis from 'ioredis';
import {
  REDIS_FLIGHT_BY_CALLSIGN_KEY,
  REDIS_FLIGHT_BY_ICAO24_KEY,
  REDIS_FLIGHT_CALLSIGNS_KEY,
  REDIS_FLIGHT_ICAO24S_KEY,
  REDIS_FLIGHTS_KEY,
} from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';
import { normalizeSearchValue, searchFlight } from '../src/search';
import { afterAll, beforeEach, describe, expect, test } from 'bun:test';

// Runs against a real Redis (database 15, flushed before each test). Skipped when none is reachable.
const redis = new Redis(process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15', {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
});
redis.on('error', () => {});
const available = await redis
  .connect()
  .then(() => true)
  .catch(() => false);

const flight = (icao24: string, callsign: string): FlightEvent => ({
  icao24,
  callsign,
  lat: 50,
  lon: 8,
  heading: 90,
  altitude: 10000,
  speed: 800,
});

// Mirrors what the feeder writes for each flight.
const seed = async (...flights: Array<FlightEvent>) => {
  const pipeline = redis.pipeline();
  for (const f of flights) {
    const icao24 = normalizeSearchValue(f.icao24);
    const callsign = normalizeSearchValue(f.callsign);
    pipeline.hset(REDIS_FLIGHTS_KEY, f.icao24, JSON.stringify(f));
    pipeline.hset(REDIS_FLIGHT_BY_ICAO24_KEY, icao24, f.icao24);
    pipeline.hset(REDIS_FLIGHT_BY_CALLSIGN_KEY, callsign, f.icao24);
    pipeline.zadd(REDIS_FLIGHT_ICAO24S_KEY, 0, `${icao24}:${f.icao24}`);
    pipeline.zadd(REDIS_FLIGHT_CALLSIGNS_KEY, 0, `${callsign}:${f.icao24}`);
  }
  await pipeline.exec();
};

const search = async (query: string) => (await searchFlight(redis, normalizeSearchValue(query)))?.icao24 ?? null;

describe.skipIf(!available)('searchFlight', () => {
  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    redis.disconnect();
  });

  test('finds by exact icao24 and callsign, case-insensitively', async () => {
    await seed(flight('3c6444', 'DLH9LF'), flight('4ca7b5', 'RYR12AB'));
    expect(await search('3C6444')).toBe('3c6444');
    expect(await search(' ryr12ab ')).toBe('4ca7b5');
  });

  test('finds by icao24 and callsign prefix', async () => {
    await seed(flight('3c6444', 'DLH9LF'), flight('4ca7b5', 'RYR12AB'));
    expect(await search('3c6')).toBe('3c6444');
    expect(await search('ryr')).toBe('4ca7b5');
  });

  test('prefers an exact callsign over a longer one sharing its prefix', async () => {
    await seed(flight('aaaaa1', 'AB12'), flight('aaaaa2', 'AB1'));
    expect(await search('ab1')).toBe('aaaaa2');
  });

  test('returns null when nothing matches', async () => {
    await seed(flight('3c6444', 'DLH9LF'));
    expect(await search('zzz')).toBeNull();
    // A near-miss sharing most of the prefix doesn't match.
    await seed(flight('111111', 'DLI100'));
    expect(await search('dlh9lg')).toBeNull();
  });

  test('skips index entries whose flight is gone or renamed', async () => {
    await seed(flight('3c6444', 'DLH9LF'), flight('4ca7b5', 'DLH100'));
    // Flight removed from the state hash but still indexed.
    await redis.hdel(REDIS_FLIGHTS_KEY, '3c6444');
    expect(await search('dlh9')).toBeNull();
    expect(await search('dlh')).toBe('4ca7b5');
    // Flight renamed: the old index entry still points at it, but its current callsign no longer matches.
    await redis.hset(REDIS_FLIGHTS_KEY, '4ca7b5', JSON.stringify(flight('4ca7b5', 'EWG55')));
    expect(await search('dlh100')).toBeNull();
  });
});
