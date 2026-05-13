import type { FlightEvent } from '@contrail/shared/types';
import type { BoundingBox } from '@contrail/shared/types';
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
  const msg = e.data;

  if (msg.type === 'snapshot') {
    removeStaleMarkers(new Set((msg.flights as FlightEvent[]).map((f) => f.icao24)));
    processChunk(msg.flights);
    resetUpdates();
  }

  if (msg.type === 'batch') {
    processChunk(msg.flights);
    incrementUpdates(msg.count);
  }

  if (msg.type === 'status') {
    setStatus(msg.value);
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
