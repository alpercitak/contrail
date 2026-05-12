import 'leaflet/dist/leaflet.css';
import { DEFAULT_FLEET_SIZE, DEFAULT_TICK_MS } from '@contrail/shared/constants';
import type { FlightEvent, GatewayMessage } from '@contrail/shared/types';
import { DOM } from './utils/dom';
import { incrementUpdates, resetUpdates, setStatus, updateAircraftCount } from './utils/hud';
import { map } from './utils/map';
import { cullOutOfViewport, deselectMarker, markers, removeStaleMarkers, upsertMarker } from './utils/marker';

const IS_DEMO = __RUNTIME_MODE__ === 'demo';
const DEFAULT_WS_RETRY_DELAY = 1000;

let ws: WebSocket | null = null;
let wsRetryDelay = DEFAULT_WS_RETRY_DELAY;

const onViewportChange = () => {
  cullOutOfViewport();
  sendViewport();
  updateAircraftCount(markers.size);
};

const sendViewport = () => {
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

const connectWS = () => {
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

const init = async () => {
  const res = await fetch(`/api/flights`);
  const flights: Array<FlightEvent> = await res.json();
  for (const flight of flights) {
    upsertMarker(flight);
  }
  connectWS();
  updateAircraftCount(flights.length);
};

const startDemo = async () => {
  const { FeedMock } = await import('@contrail/feed-mock');
  const feedMock = new FeedMock({ fleetSize: DEFAULT_FLEET_SIZE, tickMs: DEFAULT_TICK_MS });
  const flights = feedMock.snapshot();

  for (const flight of flights) {
    upsertMarker(flight);
  }

  setInterval(async () => {
    const events = await feedMock.fetch();
    for (const flight of events) {
      upsertMarker(flight);
      incrementUpdates();
    }
  }, DEFAULT_TICK_MS);

  setStatus('demo');
  updateAircraftCount(flights.length);
};

DOM.panelClose.addEventListener('click', deselectMarker);

map.on('click', deselectMarker);
map.on('moveend', onViewportChange);
map.on('zoomend', onViewportChange);

if (IS_DEMO) {
  startDemo();
} else {
  init();
}
