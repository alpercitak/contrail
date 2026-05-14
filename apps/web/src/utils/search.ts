import type { FlightEvent } from '@contrail/shared/types';
import { map } from './map';
import { markers, selectAircraft } from './marker';

export const searchFlight = async (query: string): Promise<boolean> => {
  const res = await fetch(`/api/flights/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    return false;
  }

  const flight: FlightEvent = await res.json();

  map.setView([flight.lat, flight.lon], 8, { animate: true });

  if (markers.has(flight.icao24)) {
    selectAircraft(flight.icao24);
  }

  return true;
};
