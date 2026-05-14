import type { FlightEvent } from '@contrail/shared/types';
import { map } from './map';
import { flights, selectAircraft } from './marker';

export const searchFlight = async (query: string): Promise<boolean> => {
  const res = await fetch(`/api/flights/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    return false;
  }

  const flight: FlightEvent = await res.json();

  map.flyTo({
    center: [flight.lon, flight.lat],
    zoom: 8,
    duration: 1500,
  });

  if (flights.has(flight.icao24)) {
    selectAircraft(flight.icao24);
  }

  return true;
};
