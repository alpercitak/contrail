import type { FlightEvent, BoundingBox } from '@contrail/shared/types';
import { map } from './map';
import { upsertMarker, removeStaleMarkers } from './marker';
import { resetUpdates, incrementUpdates, setStatus } from './hud';

const CHUNK_SIZE = 50;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const processChunk = (flights: Array<FlightEvent>, index = 0) => {
  const end = Math.min(index + CHUNK_SIZE, flights.length);
  for (let i = index; i < end; i++) upsertMarker(flights[i]);
  if (end < flights.length) {
    requestAnimationFrame(() => processChunk(flights, end));
  }
};

worker.onmessage = (e) => {
  const { type } = e.data;

  if (type === 'snapshot') {
    removeStaleMarkers(new Set((e.data.flights as FlightEvent[]).map((f) => f.icao24)));
    processChunk(e.data.flights);
    resetUpdates();
    return;
  }

  if (type === 'batch') {
    processChunk(e.data.flights);
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
