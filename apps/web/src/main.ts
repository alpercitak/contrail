import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FlightEvent, GatewayMessage } from '@contrail/shared/types';

type Status = 'online' | 'connecting' | 'error';

type MarkerEntry = {
  marker: L.Marker;
  el: HTMLDivElement;
  flight: FlightEvent;
};

const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;

const AIRCRAFT_SVG = `
  <div class="aircraft-icon-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,19L8,20.5L8,22L11.5,21L15,22L15,20.5L13,19L13,13.5L21,16Z"/>
    </svg>
  </div>`;

const DEFAULT_WS_RETRY_DELAY = 1000;

const map = L.map('map', { zoomControl: false }).setView([52, 10], 4);

const markers = new Map<string, MarkerEntry>();

let selectedIcao: string | null = null;
let updateCount = 0;
let ws: WebSocket | null = null;
let wsRetryDelay = DEFAULT_WS_RETRY_DELAY;

const upsertMarker = (flight: FlightEvent) => {
  const existing = markers.get(flight.icao24);

  if (existing) {
    existing.marker.setLatLng([flight.lat, flight.lon]);
    const wrapper = existing.el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
    if (wrapper) wrapper.style.transform = `rotate(${flight.heading}deg)`;
    existing.flight = flight;
    if (selectedIcao === flight.icao24) updatePanel(flight);
  } else {
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
  }
};

const removeStaleMarkers = (activeIcaos: Set<string>) => {
  for (const [icao24, entry] of markers) {
    if (!activeIcaos.has(icao24)) {
      entry.marker.remove();
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
  if (!entry) return;

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

const incrementUpdates = () => {
  updateCount++;
  document.getElementById('updates')!.textContent = String(updateCount);
};

const resetUpdates = () => {
  updateCount = 0;
  document.getElementById('updates')!.textContent = '0';
};

const setStatus = (status: Status) => {
  const dot = document.getElementById('dot')!;
  const text = document.getElementById('status-text')!;
  dot.className = 'status-dot';
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
  ws = new WebSocket(WS_URL!);

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

const startDemo = async () => {
  const { SimulationEngine } = await import('@contrail/simulation');
  const engine = new SimulationEngine({ fleetSize: 150, tickMs: 5000 });

  for (const flight of engine.snapshot()) upsertMarker(flight);

  setInterval(() => {
    for (const flight of engine.tick()) {
      upsertMarker(flight);
      incrementUpdates();
    }
  }, 5000);

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

if (WS_URL) {
  connectWS();
} else {
  startDemo();
}
