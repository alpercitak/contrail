import type { GatewayMessage } from '@contrail/shared';
import { incrementUpdates, resetUpdates, setStatus } from './hud';
import { map } from './map';
import { removeStaleMarkers, upsertMarker } from './marker';

const DEFAULT_WS_RETRY_DELAY = 1000;

let ws: WebSocket | null = null;
let wsRetryDelay = DEFAULT_WS_RETRY_DELAY;

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
      for (const flight of msg.flights) {
        upsertMarker(flight);
      }
      resetUpdates();
    } else if (msg.type === 'update') {
      upsertMarker(msg.flight);
      incrementUpdates();
    }
  });

  ws.addEventListener('close', () => {
    setStatus('error');
    setTimeout(connectWS, wsRetryDelay);
    wsRetryDelay = Math.min(wsRetryDelay * 2, 30000);
  });

  ws.addEventListener('error', () => setStatus('error'));
};
