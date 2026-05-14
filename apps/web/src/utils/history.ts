import type { FlightEvent } from '@contrail/shared/types';
import { setHistoryTrailData } from './map';

export const fetchAndDrawHistory = async (icao24: string) => {
  const res = await fetch(`/api/flights/${icao24}/history`);
  if (!res.ok) {
    return;
  }

  const history: Array<FlightEvent> = await res.json();
  if (history.length < 2) {
    return;
  }

  const coordinates = history.map(({ lon, lat }) => [lon, lat]);
  setHistoryTrailData([
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: { icao24 },
    },
  ]);
};
