import { BBOX } from '@contrail/shared/constants';
import type { FlightEvent } from '@contrail/shared/types';
import { TICK_MS } from '../constants';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const randomCallsign = (): string => `CTRAIL${Math.floor(Math.random() * 9000) + 1000}`;

const randomIcao24 = (): string =>
  Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');

const spawnAircraft = (): FlightEvent => ({
  icao24: randomIcao24(),
  callsign: randomCallsign(),
  lat: rand(BBOX.latMin, BBOX.latMax),
  lon: rand(BBOX.lonMin, BBOX.lonMax),
  heading: rand(0, 360),
  altitude: rand(6000, 12500), // cruise altitude range in meters
  speed: rand(700, 950), // km/h cruise range
});

// Move aircraft forward by one tick, apply slight heading drift
const tickAircraft = (flightEvent: FlightEvent): FlightEvent => {
  const headingDrift = rand(-3, 3);
  const heading = (flightEvent.heading + headingDrift + 360) % 360;

  const headingRad = (heading * Math.PI) / 180;
  const distKm = (flightEvent.speed * TICK_MS) / 1000 / 3600; // km travelled this tick

  // Simple flat-earth approximation — fine at this scale
  const deltaLat = (distKm / 111) * Math.cos(headingRad);
  const deltaLon = (distKm / (111 * Math.cos((flightEvent.lat * Math.PI) / 180))) * Math.sin(headingRad);

  let lat = flightEvent.lat + deltaLat;
  let lon = flightEvent.lon + deltaLon;

  // Wrap at bbox edges — aircraft re-enters from opposite side
  if (lat > BBOX.latMax) lat = BBOX.latMin;
  if (lat < BBOX.latMin) lat = BBOX.latMax;
  if (lon > BBOX.lonMax) lon = BBOX.lonMin;
  if (lon < BBOX.lonMin) lon = BBOX.lonMax;

  return { ...flightEvent, lat, lon, heading };
};

const toFlightEvent = (ac: FlightEvent): FlightEvent => ({
  icao24: ac.icao24,
  callsign: ac.callsign,
  lat: ac.lat,
  lon: ac.lon,
  heading: ac.heading,
  altitude: Math.round(ac.altitude),
  speed: Math.round(ac.speed),
  timestamp: Date.now(),
});

export { spawnAircraft, tickAircraft, toFlightEvent };
