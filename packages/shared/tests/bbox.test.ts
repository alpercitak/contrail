import { inViewport } from '../src/bbox';
import type { FlightEvent } from '../src/types';
import { describe, expect, test } from 'bun:test';

const at = (lat: number, lon: number): FlightEvent => ({
  icao24: 'abc123',
  callsign: 'TEST1',
  lat,
  lon,
  heading: 0,
  altitude: 0,
  speed: 0,
});

describe('inViewport', () => {
  const europe = { latMin: 36, latMax: 71, lonMin: -10, lonMax: 30 };

  test('regular viewport', () => {
    expect(inViewport(at(52, 10), europe)).toBe(true);
    expect(inViewport(at(52, 31), europe)).toBe(false);
    expect(inViewport(at(80, 10), europe)).toBe(false);
  });

  test('viewport crossing the antimeridian eastwards', () => {
    const pacific = { latMin: -60, latMax: 10, lonMin: 160, lonMax: 200 };
    expect(inViewport(at(-40, 175), pacific)).toBe(true);
    expect(inViewport(at(-17, -178), pacific)).toBe(true);
    expect(inViewport(at(-17, -150), pacific)).toBe(false);
  });

  test('viewport crossing the antimeridian westwards', () => {
    const pacific = { latMin: -60, latMax: 10, lonMin: -200, lonMax: -160 };
    expect(inViewport(at(-40, 175), pacific)).toBe(true);
    expect(inViewport(at(-17, -178), pacific)).toBe(true);
    expect(inViewport(at(-17, 150), pacific)).toBe(false);
  });

  test('viewport wider than the world', () => {
    expect(inViewport(at(0, 123), { latMin: -90, latMax: 90, lonMin: -400, lonMax: 400 })).toBe(true);
  });
});
