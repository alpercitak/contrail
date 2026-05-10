import type { FlightEvent } from '@contrail/shared/types';

type Status = 'online' | 'connecting' | 'error';

const WS_URL = 'ws://localhost:3001/ws';

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

const aircraftSVG = (color = '#00d4ff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
    <path d="M12 2L8 10H4l2 2-2 1 4 1 1 4 3-2 3 2 1-4 4-1-2-1 2-2h-4L12 2z"/>
  </svg>`;

const upsertMarker = (flight: FlightEvent) => {
  const existing = markers.get(flight.icao24);

  if (existing) {
    existing.marker.setLngLat([flight.lon, flight.lat]);
    existing.el.style.transform = `rotate(${flight.heading}deg)`;
    existing.flight = flight;
    if (selectedIcao === flight.icao24) updatePanel(flight);
  } else {
    const el = document.createElement('div');
    el.className = 'aircraft-marker';
    el.innerHTML = aircraftSVG();
    el.style.transform = `rotate(${flight.heading}deg)`;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectAircraft(flight.icao24);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
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
    prev.el.innerHTML = aircraftSVG();
  }

  selectedIcao = icao24;
  const entry = markers.get(icao24);
  if (!entry) return;

  entry.el.classList.add('selected');
  entry.el.innerHTML = aircraftSVG('#f59e0b');
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
    entry.el.innerHTML = aircraftSVG();
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
