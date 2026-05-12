import type { FlightEvent } from '@contrail/shared';
import type { InterpolationState, MarkerEntry } from '../types';

const TICK_MS = 5000;

const interpolationStates = new Map<string, InterpolationState>();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpHeading = (a: number, b: number, t: number) => {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
};

const startInterpolation = (flight: FlightEvent, existing: MarkerEntry) => {
  const prev = interpolationStates.get(flight.icao24);
  if (prev) {
    cancelAnimationFrame(prev.rafId);
  }

  const { lat: fromLat, lng: fromLon } = existing.marker.getLatLng();
  const wrapper = existing.el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
  const fromHeading = parseFloat(wrapper?.dataset.heading ?? String(flight.heading));

  const state: InterpolationState = {
    fromLat,
    fromLon,
    fromHeading,
    toLat: flight.lat,
    toLon: flight.lon,
    toHeading: flight.heading,
    startTime: performance.now(),
    rafId: 0,
  };

  const frame = (now: number) => {
    const t = Math.min((now - state.startTime) / TICK_MS, 1);
    existing.marker.setLatLng([lerp(state.fromLat, state.toLat, t), lerp(state.fromLon, state.toLon, t)]);
    if (wrapper) {
      const heading = lerpHeading(state.fromHeading, state.toHeading, t);
      wrapper.style.transform = `rotate(${heading}deg)`;
      wrapper.dataset.heading = String(heading);
    }
    if (t < 1) {
      state.rafId = requestAnimationFrame(frame);
    } else {
      interpolationStates.delete(flight.icao24);
    }
  };

  state.rafId = requestAnimationFrame(frame);
  interpolationStates.set(flight.icao24, state);
};

const removeInterpolation = (icao24: string) => {
  const interpolation = interpolationStates.get(icao24);
  if (interpolation) {
    cancelAnimationFrame(interpolation.rafId);
  }
  interpolationStates.delete(icao24);
};

export { startInterpolation, removeInterpolation };
