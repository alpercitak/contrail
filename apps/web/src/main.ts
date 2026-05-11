import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_FLEET_SIZE, DEFAULT_TICK_MS } from '@contrail/shared/constants';
import type { FlightEvent, GatewayMessage } from '@contrail/shared/types';

type Status = 'online' | 'connecting' | 'error';

type MarkerEntry = {
  marker: L.Marker;
  el: HTMLDivElement;
  flight: FlightEvent;
};

const IS_DEMO = __RUNTIME_MODE__ === 'demo';
const AIRCRAFT_SVG = `
  <div class="aircraft-icon-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,19L8,20.5L8,22L11.5,21L15,22L15,20.5L13,19L13,13.5L21,16Z"/>
    </svg>
  </div>`;
const DEFAULT_WS_RETRY_DELAY = 1000;
const TRAIL_LENGTH = 10;

const map = L.map('map', { zoomControl: false }).setView([52, 10], 4);
const markers = new Map<string, MarkerEntry>();
const trails = new Map<string, L.Polyline>();
const trailPositions = new Map<string, Array<[number, number]>>();

let selectedIcao: string | null = null;
let updateCount = 0;
let ws: WebSocket | null = null;
let wsRetryDelay = DEFAULT_WS_RETRY_DELAY;

const updateMarker = (flight: FlightEvent, markerEntry: MarkerEntry) => {
  markerEntry.marker.setLatLng([flight.lat, flight.lon]);
  const wrapper = markerEntry.el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
  if (wrapper) {
    wrapper.style.transform = `rotate(${flight.heading}deg)`;
  }
  markerEntry.flight = flight;
  if (selectedIcao === flight.icao24) {
    updatePanel(flight);
  }

  const positions = trailPositions.get(flight.icao24) ?? [];
  positions.push([flight.lat, flight.lon]);
  if (positions.length > TRAIL_LENGTH) {
    positions.shift();
  }
  trailPositions.set(flight.icao24, positions);

  const existingTrail = trails.get(flight.icao24);
  if (existingTrail) {
    existingTrail.setLatLngs(positions);
  } else {
    const line = L.polyline(positions, { color: '#00d4ff', weight: 1, opacity: 0.4 }).addTo(map);
    trails.set(flight.icao24, line);
  }
};

const createMarker = (flight: FlightEvent) => {
  const el = document.createElement('div');
  el.className = 'aircraft-marker';
  el.innerHTML = AIRCRAFT_SVG;

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
  const existing = markers.get(flight.icao24);
  if (existing) {
    updateMarker(flight, existing);
  } else {
    createMarker(flight);
  }
};

const removeStaleMarkers = (activeIcaos: Set<string>) => {
  for (const [icao24, entry] of markers) {
    if (!activeIcaos.has(icao24)) {
      entry.marker.remove();
      trails.get(icao24)?.remove();
      trails.delete(icao24);
      trailPositions.delete(icao24);
      markers.delete(icao24);
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
  document.getElementById('panel')!.classList.add('visible');
};

const deselect = () => {
  if (selectedIcao && markers.has(selectedIcao)) {
    markers.get(selectedIcao)!.el.classList.remove('selected');
  }
  selectedIcao = null;
  document.getElementById('panel')!.classList.remove('visible');
};

const updatePanel = (flight: FlightEvent) => {
  document.getElementById('p-callsign')!.textContent = flight.callsign;
  document.getElementById('p-icao')!.textContent = flight.icao24;
  document.getElementById('p-alt')!.textContent = `${Math.round(flight.altitude).toLocaleString()} m`;
  document.getElementById('p-spd')!.textContent = `${Math.round(flight.speed)} km/h`;
  document.getElementById('p-hdg')!.textContent = `${Math.round(flight.heading)}°`;
  document.getElementById('p-pos')!.textContent = `${flight.lat.toFixed(2)}, ${flight.lon.toFixed(2)}`;
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
  animateCount(document.getElementById('updates')!, updateCount);
};

const resetUpdates = () => {
  updateCount = 0;
  document.getElementById('updates')!.textContent = '0';
};

const setStatus = (status: Status) => {
  const dot = document.getElementById('dot')!;
  const text = document.getElementById('status-text')!;
  dot.className = 'status-dot';
  if (IS_DEMO) {
    text.textContent = 'demo';
    return;
  }
  if (status === 'online') {
    dot.classList.add('online');
    text.textContent = 'live';
  } else if (status === 'error') {
    dot.classList.add('error');
    text.textContent = 'disconnected';
  } else {
    text.textContent = 'connecting…';
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
};

const startDemo = async () => {
  const { SimulationEngine } = await import('@contrail/simulation');
  const engine = new SimulationEngine({ fleetSize: DEFAULT_FLEET_SIZE, tickMs: DEFAULT_TICK_MS });

  for (const flight of engine.snapshot()) upsertMarker(flight);

  setInterval(() => {
    for (const flight of engine.tick()) {
      upsertMarker(flight);
      incrementUpdates();
    }
  }, DEFAULT_TICK_MS);

  setStatus('online');
};

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
  attribution: '',
  maxZoom: 10,
}).addTo(map);

L.control.zoom({ position: 'bottomleft' }).addTo(map);

document.getElementById('panel-close')!.addEventListener('click', deselect);

map.on('click', deselect);
map.on('moveend', sendViewport);
map.on('zoomend', sendViewport);

if (IS_DEMO) {
  startDemo();
} else {
  init();
}
