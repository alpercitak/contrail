import type { FlightEvent, GatewayMessage } from '@contrail/shared';
import { incrementUpdates, resetUpdates, setStatus } from './hud';
import { map } from './map';
import { removeStaleMarkers, upsertMarker } from './marker';

const DEFAULT_WS_RETRY_DELAY = 1000;
const BATCH_DELAY_MS = 200;
const CHUNK_SIZE = 50;

let ws: WebSocket | null = null;
let wsRetryDelay = DEFAULT_WS_RETRY_DELAY;
let pendingUpdates: Array<FlightEvent> = [];
let rafScheduled = false;

export const sendViewport = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  const bounds = map.getBounds();
  ws.send(
    JSON.stringify({
      type: 'viewport',
      bbox: {
        latMin: bounds.getSouth(),
        latMax: bounds.getNorth(),
        lonMin: bounds.getWest(),
        lonMax: bounds.getEast(),
      },
    }),
  );
};

const processChunk = (flights: Array<FlightEvent>, index = 0) => {
  const end = Math.min(index + CHUNK_SIZE, flights.length);
  for (let i = index; i < end; i++) upsertMarker(flights[i]);
  if (end < flights.length) {
    requestAnimationFrame(() => processChunk(flights, end));
  }
};

export const connectWS = () => {
  setStatus('connecting');
  ws = new WebSocket('/ws');

  ws.addEventListener('open', () => {
    setStatus('online');
    wsRetryDelay = DEFAULT_WS_RETRY_DELAY;
    sendViewport();
  });

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data) as GatewayMessage;

    if (msg.type === 'snapshot') {
      removeStaleMarkers(new Set(msg.flights.map((f) => f.icao24)));
      processChunk(msg.flights);
      resetUpdates();
      return;
    }

    if (msg.type === 'update') {
      pendingUpdates.push(msg.flight);
      if (rafScheduled) {
        return;
      }
      rafScheduled = true;
      setTimeout(() => {
        const flights = [...pendingUpdates];
        pendingUpdates.length = 0;
        rafScheduled = false;
        processChunk(flights);
        incrementUpdates(flights.length);
      }, BATCH_DELAY_MS);
    }
  });

  ws.addEventListener('close', () => {
    setStatus('error');
    setTimeout(connectWS, wsRetryDelay);
    wsRetryDelay = Math.min(wsRetryDelay * 2, 30000);
  });

  ws.addEventListener('error', () => setStatus('error'));
};
