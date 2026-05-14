import 'leaflet/dist/leaflet.css';
import type { FlightEvent } from '@contrail/shared/types';
import { startDemo } from './utils/demo';
import { DOM } from './utils/dom';
import { updateAircraftCount } from './utils/hud';
import { map } from './utils/map';
import { cullOutOfViewport, deselectMarker, markers, upsertMarker } from './utils/marker';
import { searchFlight } from './utils/search';
import { connectWS, sendViewport } from './utils/ws';

const IS_DEMO = __RUNTIME_MODE__ === 'demo';

const onViewportChange = () => {
  cullOutOfViewport();
  sendViewport();
  updateAircraftCount(markers.size);
};

const init = async () => {
  const res = await fetch(`/api/flights`);
  const flights: Array<FlightEvent> = await res.json();
  for (const flight of flights) {
    upsertMarker(flight);
  }
  connectWS('/ws');
  updateAircraftCount(flights.length);
};

map.on('click', deselectMarker);
map.on('moveend', onViewportChange);
map.on('zoomend', onViewportChange);
DOM.panelClose.addEventListener('click', deselectMarker);

DOM.search.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const input = e.target as HTMLInputElement;
  const q = input.value.trim();
  if (!q) {
    return;
  }

  const found = await searchFlight(q);
  if (!found) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 1000);
  } else {
    input.value = '';
  }
});

if (IS_DEMO) {
  startDemo();
} else {
  init();
}
