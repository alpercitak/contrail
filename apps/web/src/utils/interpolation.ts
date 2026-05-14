import type { FlightEvent } from '@contrail/shared/types';
import { flights, upsertFlight } from './marker';
import type { InterpolationState } from '../types';

const interpolationStates = new Map<string, InterpolationState>();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpHeading = (a: number, b: number, t: number) => {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
};

export const startInterpolation = (flight: FlightEvent, tickMs: number) => {
  const prev = interpolationStates.get(flight.icao24);
  if (prev) {
    cancelAnimationFrame(prev.rafId);
  }

  const current = flights.get(flight.icao24);
  if (!current) {
    upsertFlight(flight);
    return;
  }

  const state: InterpolationState = {
    fromLat: current.lat,
    fromLon: current.lon,
    fromHeading: current.heading,
    toLat: flight.lat,
    toLon: flight.lon,
    toHeading: flight.heading,
    startTime: performance.now(),
    tickMs,
    rafId: 0,
    flight,
  };

  const frame = (now: number) => {
    const t = Math.min((now - state.startTime) / state.tickMs, 1);
    upsertFlight({
      ...state.flight,
      lat: lerp(state.fromLat, state.toLat, t),
      lon: lerp(state.fromLon, state.toLon, t),
      heading: lerpHeading(state.fromHeading, state.toHeading, t),
    });
    if (t < 1) {
      state.rafId = requestAnimationFrame(frame);
    } else {
      interpolationStates.delete(flight.icao24);
    }
  };

  state.rafId = requestAnimationFrame(frame);
  interpolationStates.set(flight.icao24, state);
};

export const removeInterpolation = (icao24: string) => {
  const interpolation = interpolationStates.get(icao24);
  if (interpolation) {
    cancelAnimationFrame(interpolation.rafId);
  }
  interpolationStates.delete(icao24);
};
