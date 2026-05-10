import type { FlightEvent } from '@contrail/shared/types';

type Status = 'online' | 'connecting' | 'error';

const WS_URL = 'ws://localhost:3001/ws';

const AIRCRAFT_SVG = `<div class="aircraft-icon-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,19L8,20.5L8,22L11.5,21L15,22L15,20.5L13,19L13,13.5L21,16Z"/>
    </svg>
  </div>`;

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json',
  center: [10, 52],
  zoom: 4,
  minZoom: 3,
  maxZoom: 10,
});

map.addControl(new maplibregl.NavigationControl(), 'bottom-left');

const markers = new Map(); // icao24 → { marker, el }
let selectedIcao: string | null = null;
let updateCount = 0;
let updatesThisMinute = 0;

const upsertMarker = (flight: FlightEvent) => {
  const existing = markers.get(flight.icao24);

  if (existing) {
    existing.marker.setLngLat([flight.lon, flight.lat]);
    const wrapper = existing.el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
    if (wrapper) {
      wrapper.style.transform = `rotate(${flight.heading}deg)`;
    }
    existing.flight = flight;
    if (selectedIcao === flight.icao24) {
      updatePanel(flight);
    }
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

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat([flight.lon, flight.lat])
      .addTo(map);

    markers.set(flight.icao24, { marker, el, flight });
  }
};

const selectAircraft = (icao24: string) => {
  // Deselect previous
  if (selectedIcao && markers.has(selectedIcao)) {
    const prev = markers.get(selectedIcao);
    prev.el.classList.remove('selected');
  }

  selectedIcao = icao24;
  const entry = markers.get(icao24);
  if (!entry) return;

  entry.el.classList.add('selected');
  updatePanel(entry.flight);
  document.getElementById('panel')!.classList.add('visible');
};

const updatePanel = (flight: FlightEvent) => {
  document.getElementById('p-callsign')!.textContent = flight.callsign;
  document.getElementById('p-icao')!.textContent = flight.icao24;
  document.getElementById('p-alt')!.textContent = `${Math.round(flight.altitude).toLocaleString()} m`;
  document.getElementById('p-spd')!.textContent = `${Math.round(flight.speed)} km/h`;
  document.getElementById('p-hdg')!.textContent = `${Math.round(flight.heading)}°`;
  document.getElementById('p-pos')!.textContent = `${flight.lat.toFixed(2)}, ${flight.lon.toFixed(2)}`;
};

const updateHUD = () => {
  document.getElementById('count')!.textContent = String(markers.size);
  document.getElementById('updates')!.textContent = String(updatesThisMinute);
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

const connect = () => {
  setStatus('connecting');
  const ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => setStatus('online'));

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'snapshot') {
      for (const flight of msg.flights) {
        upsertMarker(flight);
      }
      updateHUD();
    } else if (msg.type === 'update') {
      upsertMarker(msg.flight);
      updateCount++;
    }
  });

  ws.addEventListener('close', () => {
    setStatus('error');
    setTimeout(connect, 3000); // auto-reconnect
  });

  ws.addEventListener('error', () => setStatus('error'));
};

// Close panel
document.getElementById('panel-close')!.addEventListener('click', () => {
  if (selectedIcao && markers.has(selectedIcao)) {
    const entry = markers.get(selectedIcao);
    entry.el.classList.remove('selected');
  }
  selectedIcao = null;
  document.getElementById('panel')!.classList.remove('visible');
});

// Click map to deselect
map.on('click', () => {
  document.getElementById('panel-close')!.click();
});

map.on('load', connect);

setInterval(() => {
  updatesThisMinute = updateCount;
  updateCount = 0;
  updateHUD();
}, 60000);
