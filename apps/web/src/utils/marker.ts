import type { FlightEvent } from '@contrail/shared/types';
import { fetchAndDrawHistory } from './history';
import { updateAircraftCount } from './hud';
import { map, setAircraftData, setSelectedFilter, clearSelectedFilter, setHistoryTrailData } from './map';
import { updatePanel, showPanel, hidePanel } from './panel';

export const flights = new Map<string, FlightEvent>();
let selectedIcao: string | null = null;
let renderScheduled = false;

const scheduleRender = () => {
  if (renderScheduled) {
    return;
  }
  renderScheduled = true;
  requestAnimationFrame(() => {
    const features: Array<GeoJSON.Feature> = Array.from(flights.values()).map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: {
        icao24: f.icao24,
        callsign: f.callsign,
        altitude: f.altitude,
        speed: f.speed,
        heading: f.heading,
      },
    }));
    setAircraftData(features);
    updateAircraftCount(features.length);
    renderScheduled = false;
  });
};

export const upsertFlight = (flight: FlightEvent) => {
  flights.set(flight.icao24, flight);
  if (selectedIcao === flight.icao24) {
    updatePanel(flight);
  }
  scheduleRender();
};

export const removeFlight = (icao24: string) => {
  flights.delete(icao24);
  scheduleRender();
};

export const removeStaleFlights = (activeIcaos: Set<string>) => {
  for (const icao24 of flights.keys()) {
    if (!activeIcaos.has(icao24)) {
      flights.delete(icao24);
    }
  }
  scheduleRender();
};

export const cullOutOfViewport = () => {
  const bounds = map.getBounds();
  let changed = false;
  for (const [icao24, flight] of flights) {
    if (!bounds.contains([flight.lon, flight.lat])) {
      flights.delete(icao24);
      changed = true;
    }
  }
  if (changed) {
    scheduleRender();
  }
};

export const selectAircraft = (icao24: string) => {
  selectedIcao = icao24;
  setSelectedFilter(icao24);
  const flight = flights.get(icao24);
  if (flight) {
    updatePanel(flight);
    showPanel();
    fetchAndDrawHistory(icao24);
  }
};

export const deselectMarker = () => {
  selectedIcao = null;
  clearSelectedFilter();
  hidePanel();
  setHistoryTrailData([]);
};

map.on('click', 'aircraft', (e) => {
  const feature = e.features?.[0];
  const icao24 = feature?.properties?.icao24;
  if (icao24) {
    selectAircraft(icao24);
  }
});

map.on('click', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['aircraft'] });
  if (features.length === 0) {
    deselectMarker();
  }
});

map.on('mouseenter', 'aircraft', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'aircraft', () => {
  map.getCanvas().style.cursor = '';
});
