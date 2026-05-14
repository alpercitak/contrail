import type { FlightEvent } from '@contrail/shared/types';
import { toAircraftFeature, type AircraftFeature } from './aircraft-feature';
import { fetchAndDrawHistory } from './history';
import { updateAircraftCount } from './hud';
import { map, setAircraftData, setSelectedFilter, clearSelectedFilter, setHistoryTrailData } from './map';
import { updatePanel, showPanel, hidePanel } from './panel';
import { scheduleMapDataRender } from './render-scheduler';

export const flights = new Map<string, FlightEvent>();
const aircraftFeatures = new Map<string, AircraftFeature>();
let selectedIcao: string | null = null;

const renderAircraft = () => {
  const features = Array.from(aircraftFeatures.values());
  setAircraftData(features);
  updateAircraftCount(features.length);
};

export const upsertFlight = (flight: FlightEvent, feature = toAircraftFeature(flight)) => {
  flights.set(flight.icao24, flight);
  aircraftFeatures.set(flight.icao24, feature);
  if (selectedIcao === flight.icao24) {
    updatePanel(flight);
  }
  scheduleMapDataRender(renderAircraft);
};

export const removeFlight = (icao24: string) => {
  flights.delete(icao24);
  aircraftFeatures.delete(icao24);
  scheduleMapDataRender(renderAircraft);
};

export const removeStaleFlights = (activeIcaos: Set<string>) => {
  for (const icao24 of flights.keys()) {
    if (!activeIcaos.has(icao24)) {
      flights.delete(icao24);
      aircraftFeatures.delete(icao24);
    }
  }
  scheduleMapDataRender(renderAircraft);
};

export const cullOutOfViewport = () => {
  const bounds = map.getBounds();
  let changed = false;
  for (const [icao24, flight] of flights) {
    if (!bounds.contains([flight.lon, flight.lat])) {
      flights.delete(icao24);
      aircraftFeatures.delete(icao24);
      changed = true;
    }
  }
  if (changed) {
    scheduleMapDataRender(renderAircraft);
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
