import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_FLEET_SIZE, DEFAULT_TICK_MS } from '@contrail/shared/constants';
import type { FlightEvent, GatewayMessage } from '@contrail/shared/types';
import type { MarkerEntry, Status } from './types';
import { DOM } from './utils/dom';
import { removeInterpolation, startInterpolation } from './utils/interpolation';
import { map } from './utils/map';
import { addTrailPoint, removeTrail } from './utils/trail';

const IS_DEMO = __RUNTIME_MODE__ === 'demo';
const DEFAULT_WS_RETRY_DELAY = 1000;

const markers = new Map<string, MarkerEntry>();

let selectedIcao: string | null = null;
let updateCount = 0;
let ws: WebSocket | null = null;
let wsRetryDelay = DEFAULT_WS_RETRY_DELAY;

const getAircraftSVG = (color: string) => `
  <div class="aircraft-icon-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
      <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,19L8,20.5L8,22L11.5,21L15,22L15,20.5L13,19L13,13.5L21,16Z"/>
    </svg>
  </div>`;

const altitudeColor = (altitude: number): string => {
  if (altitude < 3000) return '#f59e0b'; // low — amber
  if (altitude < 8000) return '#22c55e'; // mid — green
  return '#00d4ff'; // high cruise — cyan (existing default)
};

const updateMarker = (flight: FlightEvent, markerEntry: MarkerEntry) => {
  markerEntry.marker.setLatLng([flight.lat, flight.lon]);
  const wrapper = markerEntry.el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
  if (wrapper) {
    wrapper.style.transform = `rotate(${flight.heading}deg)`;
    wrapper.innerHTML = getAircraftSVG(altitudeColor(flight.altitude));
  }
  startInterpolation(flight, markerEntry);
  markerEntry.flight = flight;
  if (selectedIcao === flight.icao24) {
    updatePanel(flight);
  }

  addTrailPoint(flight.icao24, flight.lat, flight.lon);
};

const createMarker = (flight: FlightEvent) => {
  const el = document.createElement('div');
  el.className = 'aircraft-marker';
  el.innerHTML = getAircraftSVG(altitudeColor(flight.altitude));

  const wrapper = el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
  wrapper.style.transform = `rotate(${flight.heading}deg)`;

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectAircraft(flight.icao24);
  });

  const icon = L.divIcon({ html: el, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
  const marker = L.marker([flight.lat, flight.lon], { icon }).addTo(map);

  markers.set(flight.icao24, { marker, el, flight });
};

const upsertMarker = (flight: FlightEvent) => {
  const inView = map.getBounds().contains([flight.lat, flight.lon]);
  const existing = markers.get(flight.icao24);

  if (!inView && existing) {
    removeMarker(flight.icao24);
    return;
  }

  if (existing) {
    updateMarker(flight, existing);
  } else {
    createMarker(flight);
  }
};

const removeMarker = (icao24: string) => {
  removeInterpolation(icao24);
  markers.get(icao24)?.marker.remove();
  markers.delete(icao24);
  removeTrail(icao24);
};

const removeStaleMarkers = (activeIcaos: Set<string>) => {
  for (const [icao24, entry] of markers) {
    if (!activeIcaos.has(icao24)) {
      entry.marker.remove();
      removeMarker(icao24);
    }
  }
};

const selectAircraft = (icao24: string) => {
  if (selectedIcao && markers.has(selectedIcao)) {
    markers.get(selectedIcao)!.el.classList.remove('selected');
  }

  selectedIcao = icao24;
  const entry = markers.get(icao24);
  if (!entry) {
    return;
  }

  entry.el.classList.add('selected');
  updatePanel(entry.flight);
  DOM.panel.classList.add('visible');
};

const deselect = () => {
  if (selectedIcao && markers.has(selectedIcao)) {
    markers.get(selectedIcao)!.el.classList.remove('selected');
  }
  selectedIcao = null;
  DOM.panel.classList.remove('visible');
};

const updatePanel = (flight: FlightEvent) => {
  DOM.callsign.textContent = flight.callsign;
  DOM.icao.textContent = flight.icao24;
  DOM.alt.textContent = `${Math.round(flight.altitude).toLocaleString()} m`;
  DOM.spd.textContent = `${Math.round(flight.speed)} km/h`;
  DOM.hdg.textContent = `${Math.round(flight.heading)}°`;
  DOM.pos.textContent = `${flight.lat.toFixed(2)}, ${flight.lon.toFixed(2)}`;
};

const animateCount = (el: HTMLElement, target: number) => {
  const current = parseInt(el.textContent ?? '0');
  if (current >= target) {
    return;
  }
  el.textContent = String(current + 1);
  setTimeout(() => animateCount(el, target), 300);
};

const incrementUpdates = () => {
  updateCount++;
  animateCount(DOM.updates, updateCount);
};

const resetUpdates = () => {
  updateCount = 0;
  DOM.updates.textContent = '0';
};

const cullOutOfViewport = () => {
  const bounds = map.getBounds();
  for (const [icao24, entry] of markers) {
    if (!bounds.contains([entry.flight.lat, entry.flight.lon])) {
      removeMarker(icao24);
    }
  }
};

const updateAircraftCount = () => {
  DOM.statusAircrafts.textContent = String(markers.size);
};

const onViewportChange = () => {
  cullOutOfViewport();
  sendViewport();
  updateAircraftCount();
};

const setStatus = (status: Status) => {
  DOM.dot.className = 'status-dot';
  if (IS_DEMO) {
    DOM.statusText.textContent = 'demo';
    return;
  }
  if (status === 'online') {
    DOM.dot.classList.add('online');
    DOM.statusText.textContent = 'live';
  } else if (status === 'error') {
    DOM.dot.classList.add('error');
    DOM.statusText.textContent = 'disconnected';
  } else {
    DOM.statusText.textContent = 'connecting…';
  }
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
  updateAircraftCount();
};

const startDemo = async () => {
  const { FeedMock } = await import('@contrail/feed-mock');
  const feedMock = new FeedMock({ fleetSize: DEFAULT_FLEET_SIZE, tickMs: DEFAULT_TICK_MS });

  for (const flight of feedMock.snapshot()) {
    upsertMarker(flight);
  }

  setInterval(async () => {
    const events = await feedMock.fetch();
    for (const flight of events) {
      upsertMarker(flight);
      incrementUpdates();
    }
  }, DEFAULT_TICK_MS);

  setStatus('online');
  updateAircraftCount();
};

DOM.panelClose.addEventListener('click', deselect);

map.on('click', deselect);
map.on('moveend', onViewportChange);
map.on('zoomend', onViewportChange);

if (IS_DEMO) {
  startDemo();
} else {
  init();
}
