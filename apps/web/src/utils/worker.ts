import type { FlightEvent, BoundingBox } from '@contrail/shared/types';
import { decodeGatewayMessage, encodeGatewayMessage } from '@contrail/shared';
import { toAircraftFeature, type AircraftFeature } from './aircraft-feature';

type MainMessage = { type: 'connect'; url: string } | { type: 'viewport'; bbox: BoundingBox };
export type ShapedFlight = { flight: FlightEvent; feature: AircraftFeature };

type WorkerMessage =
  | { type: 'snapshot'; flights: Array<ShapedFlight> }
  | { type: 'batch'; flights: Array<ShapedFlight>; count: number }
  | { type: 'status'; value: 'online' | 'connecting' | 'error' };

const MIN_DISTANCE = 0.01;

let ws: WebSocket | null = null;
let bbox: BoundingBox | null = null;
let retryDelay = 1000;
let wsUrl = '';
let pendingUpdates = new Map<string, FlightEvent>();
let flushScheduled = false;
const knownState = new Map<string, FlightEvent>();

const inViewport = (flight: FlightEvent, b: BoundingBox): boolean =>
  flight.lat >= b.latMin && flight.lat <= b.latMax && flight.lon >= b.lonMin && flight.lon <= b.lonMax;

const hasChanged = (prev: FlightEvent, next: FlightEvent): boolean => {
  const latDiff = Math.abs(prev.lat - next.lat);
  const lonDiff = Math.abs(prev.lon - next.lon);
  return latDiff > MIN_DISTANCE || lonDiff > MIN_DISTANCE;
};

const toShapedFlight = (flight: FlightEvent): ShapedFlight => ({
  flight,
  feature: toAircraftFeature(flight),
});

const flush = () => {
  flushScheduled = false;
  if (pendingUpdates.size === 0) {
    return;
  }

  const updates = pendingUpdates;
  pendingUpdates = new Map();

  const toRender = Array.from(updates.values()).filter((flight) => {
    if (bbox && !inViewport(flight, bbox)) {
      return false;
    }
    const prev = knownState.get(flight.icao24);
    if (prev && !hasChanged(prev, flight)) {
      return false;
    }
    knownState.set(flight.icao24, flight);
    return true;
  });

  if (toRender.length === 0) {
    return;
  }

  self.postMessage({
    type: 'batch',
    flights: toRender.map(toShapedFlight),
    count: toRender.length,
  } satisfies WorkerMessage);
};

const ingest = (flight: FlightEvent) => {
  pendingUpdates.set(flight.icao24, flight);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(flush, 200);
  }
};

const connect = (url: string) => {
  wsUrl = url;
  self.postMessage({ type: 'status', value: 'connecting' } satisfies WorkerMessage);
  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    self.postMessage({ type: 'status', value: 'online' } satisfies WorkerMessage);
    retryDelay = 1000;
    if (bbox) {
      ws?.send(JSON.stringify(encodeGatewayMessage({ type: 'viewport', bbox })));
    }
  });

  ws.addEventListener('message', (e) => {
    const msg = decodeGatewayMessage(JSON.parse(e.data));

    if (msg.type === 'snapshot') {
      knownState.clear();
      const flights = bbox ? msg.flights.filter((f) => inViewport(f, bbox!)) : msg.flights;
      for (const f of flights) {
        knownState.set(f.icao24, f);
      }
      self.postMessage({ type: 'snapshot', flights: flights.map(toShapedFlight) } satisfies WorkerMessage);
      return;
    }

    if (msg.type === 'update') {
      ingest(msg.flight);
    }

    if (msg.type === 'batch') {
      for (const flight of msg.flights) {
        ingest(flight);
      }
    }
  });

  ws.addEventListener('close', () => {
    self.postMessage({ type: 'status', value: 'error' } satisfies WorkerMessage);
    setTimeout(() => connect(wsUrl), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  });

  ws.addEventListener('error', () => {
    self.postMessage({ type: 'status', value: 'error' } satisfies WorkerMessage);
  });
};

self.onmessage = (e: MessageEvent<MainMessage>) => {
  const msg = e.data;

  if (msg.type === 'connect') {
    connect(msg.url);
  }

  if (msg.type === 'viewport') {
    bbox = msg.bbox;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(encodeGatewayMessage({ type: 'viewport', bbox })));
    }
  }
};
