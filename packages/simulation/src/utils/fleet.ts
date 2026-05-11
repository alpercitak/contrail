import { BBOX } from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';
import { randomCallsign, randomIcao24 } from './callsign';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnAircraft = (): FlightEvent => ({
  icao24: randomIcao24(),
  callsign: randomCallsign(),
  lat: rand(BBOX.latMin, BBOX.latMax),
  lon: rand(BBOX.lonMin, BBOX.lonMax),
  heading: rand(0, 360),
  altitude: rand(6000, 12500), // cruise altitude range in meters
  speed: rand(700, 950), // km/h cruise range
});

export const spawnFleet = (size: number): Map<string, FlightEvent> => {
  const fleet = new Map<string, FlightEvent>();
  for (let i = 0; i < size; i++) {
    const ac = spawnAircraft();
    fleet.set(ac.icao24, ac);
  }
  return fleet;
};

export const tickAircraft = (flightEvent: FlightEvent, tickMs: number): FlightEvent => {
  const headingDrift = rand(-3, 3);
  const heading = (flightEvent.heading + headingDrift + 360) % 360;
  const headingRad = (heading * Math.PI) / 180;
  const distKm = (flightEvent.speed * tickMs) / 1000 / 3600;

  // Flat-earth approximation
  const deltaLat = (distKm / 111) * Math.cos(headingRad);
  const deltaLon = (distKm / (111 * Math.cos((flightEvent.lat * Math.PI) / 180))) * Math.sin(headingRad);

  let lat = flightEvent.lat + deltaLat;
  let lon = flightEvent.lon + deltaLon;

  // Wrap at bbox edges
  if (lat > BBOX.latMax) lat = BBOX.latMin;
  if (lat < BBOX.latMin) lat = BBOX.latMax;
  if (lon > BBOX.lonMax) lon = BBOX.lonMin;
  if (lon < BBOX.lonMin) lon = BBOX.lonMax;

  return { ...flightEvent, lat, lon, heading };
};

export const toFlightEvent = (flightEvent: FlightEvent): FlightEvent => ({
  ...flightEvent,
  altitude: Math.round(flightEvent.altitude),
  speed: Math.round(flightEvent.speed),
  timestamp: Date.now(),
});
