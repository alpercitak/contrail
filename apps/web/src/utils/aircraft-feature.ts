import type { FlightEvent } from '@contrail/shared/types';

type AircraftProperties = Pick<FlightEvent, 'icao24' | 'callsign' | 'altitude' | 'speed' | 'heading'>;

export type AircraftFeature = GeoJSON.Feature<GeoJSON.Point, AircraftProperties>;

export const toAircraftFeature = (flight: FlightEvent): AircraftFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [flight.lon, flight.lat] },
  properties: {
    icao24: flight.icao24,
    callsign: flight.callsign,
    altitude: flight.altitude,
    speed: flight.speed,
    heading: flight.heading,
  },
});
