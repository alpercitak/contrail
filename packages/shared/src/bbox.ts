import type { BoundingBox, FlightEvent } from './types';

// Longitudes wrap: a viewport crossing the antimeridian has lonMin < -180 or lonMax > 180 (MapLibre world copies),
// so compare the flight's eastward offset from lonMin against the viewport width instead of raw longitudes.
export const inViewport = (flight: FlightEvent, bbox: BoundingBox): boolean => {
  if (flight.lat < bbox.latMin || flight.lat > bbox.latMax) {
    return false;
  }
  const width = bbox.lonMax - bbox.lonMin;
  if (width >= 360) {
    return true;
  }
  const offset = (((flight.lon - bbox.lonMin) % 360) + 360) % 360;
  return offset <= width;
};
