import type { FlightEvent, BoundingBox } from '@contrail/shared/types';
import { map } from './map';
import { upsertFlight, removeStaleFlights } from './marker';
import { addTrailPoint } from './trail';
import { resetUpdates, incrementUpdates, setStatus } from './hud';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
  const { type } = e.data;

  if (type === 'snapshot') {
    const flights = e.data.flights as Array<FlightEvent>;
    removeStaleFlights(new Set(flights.map((f) => f.icao24)));
    for (const flight of flights) {
      upsertFlight(flight);
      addTrailPoint(flight.icao24, flight.lon, flight.lat);
    }
    resetUpdates();
    return;
  }

  if (type === 'batch') {
    const flights = e.data.flights as FlightEvent[];
    for (const flight of flights) {
      upsertFlight(flight);
      addTrailPoint(flight.icao24, flight.lon, flight.lat);
    }
    incrementUpdates(e.data.count);
    return;
  }

  if (type === 'status') {
    setStatus(e.data.value);
  }
};

export const sendViewport = () => {
  const b = map.getBounds();
  const bbox: BoundingBox = {
    latMin: b.getSouth(),
    latMax: b.getNorth(),
    lonMin: b.getWest(),
    lonMax: b.getEast(),
  };
  worker.postMessage({ type: 'viewport', bbox });
};

export const connectWS = (url: string) => {
  worker.postMessage({ type: 'connect', url });
};
