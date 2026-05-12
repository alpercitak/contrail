import 'leaflet/dist/leaflet.css';
import type { FlightEvent } from '@contrail/shared/types';
import { startDemo } from './utils/demo';
import { DOM } from './utils/dom';
import { updateAircraftCount } from './utils/hud';
import { map } from './utils/map';
import { cullOutOfViewport, deselectMarker, markers, upsertMarker } from './utils/marker';
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
  connectWS();
  updateAircraftCount(flights.length);
};

map.on('click', deselectMarker);
map.on('moveend', onViewportChange);
map.on('zoomend', onViewportChange);
DOM.panelClose.addEventListener('click', deselectMarker);

if (IS_DEMO) {
  startDemo();
} else {
  init();
}
