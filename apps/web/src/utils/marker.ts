import L from 'leaflet';
import type { FlightEvent } from '@contrail/shared/types';
import type { MarkerEntry } from '../types';
import { map } from './map';
import { addTrailPoint, removeTrail } from './trail';
import { startInterpolation, removeInterpolation } from './interpolation';
import { updatePanel, showPanel, hidePanel } from './panel';
import { updateAircraftCount } from './hud';

export const markers = new Map<string, MarkerEntry>();
let selectedIcao: string | null = null;
let countRafId: number | null = null;

const getAltitudeColor = (altitude: number): string => {
  if (altitude < 3000) return '#f59e0b';
  if (altitude < 8000) return '#22c55e';
  return '#00d4ff';
};

const getAircraftSVG = (color: string): string => `
  <div class="aircraft-icon-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
      <path d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,19L8,20.5L8,22L11.5,21L15,22L15,20.5L13,19L13,13.5L21,16Z"/>
    </svg>
  </div>`;

const scheduleCountUpdate = () => {
  if (countRafId) {
    return;
  }
  countRafId = requestAnimationFrame(() => {
    updateAircraftCount(markers.size);
    countRafId = null;
  });
};

export const removeMarker = (icao24: string) => {
  removeInterpolation(icao24);
  markers.get(icao24)?.marker.remove();
  removeTrail(icao24);
  markers.delete(icao24);
  scheduleCountUpdate();
};

const updateMarker = (flight: FlightEvent, entry: MarkerEntry) => {
  const newColor = getAltitudeColor(flight.altitude);
  if (entry.svg.getAttribute('fill') !== newColor) {
    entry.svg.setAttribute('fill', newColor);
  }

  startInterpolation(flight, entry);
  addTrailPoint(flight.icao24, flight.lat, flight.lon);
  entry.flight = flight;

  if (selectedIcao === flight.icao24) {
    updatePanel(flight);
  }
};

const createMarker = (flight: FlightEvent) => {
  const el = document.createElement('div');
  el.className = 'aircraft-marker';

  const color = getAltitudeColor(flight.altitude);
  el.innerHTML = getAircraftSVG(color);

  const wrapper = el.querySelector('.aircraft-icon-wrapper') as HTMLElement;
  const svg = wrapper.querySelector('svg') as SVGElement;

  wrapper.style.transform = `rotate(${flight.heading}deg)`;
  wrapper.dataset.heading = String(flight.heading);
  svg.setAttribute('fill', color);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectAircraft(flight.icao24);
  });

  const icon = L.divIcon({ html: el, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
  const marker = L.marker([flight.lat, flight.lon], { icon }).addTo(map);

  markers.set(flight.icao24, { marker, el, wrapper, svg, flight });
  scheduleCountUpdate();
};

export const upsertMarker = (flight: FlightEvent) => {
  const existing = markers.get(flight.icao24);

  if (existing) {
    updateMarker(flight, existing);
  } else {
    createMarker(flight);
  }
};

export const removeStaleMarkers = (activeIcaos: Set<string>) => {
  for (const [icao24] of markers) {
    if (!activeIcaos.has(icao24)) {
      removeMarker(icao24);
    }
  }
};

export const cullOutOfViewport = () => {
  const bounds = map.getBounds();
  for (const [icao24, entry] of markers) {
    if (!bounds.contains([entry.flight.lat, entry.flight.lon])) {
      removeMarker(icao24);
    }
  }
};

export const selectAircraft = (icao24: string) => {
  if (selectedIcao && markers.has(selectedIcao)) {
    markers.get(selectedIcao)!.el.classList.remove('selected');
  }

  selectedIcao = icao24;
  const entry = markers.get(icao24);
  if (!entry) return;

  entry.el.classList.add('selected');
  updatePanel(entry.flight);
  showPanel();
};

export const deselectMarker = () => {
  if (selectedIcao && markers.has(selectedIcao)) {
    markers.get(selectedIcao)!.el.classList.remove('selected');
  }
  selectedIcao = null;
  hidePanel();
};
