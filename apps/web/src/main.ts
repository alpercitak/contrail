import { startDemo } from './utils/demo';
import { DOM } from './utils/dom';
import { updateAircraftCount } from './utils/hud';
import { map } from './utils/map';
import { cullOutOfViewport, deselectMarker, flights } from './utils/marker';
import { searchFlight } from './utils/search';
import { connectWS, sendViewport } from './utils/ws';

const IS_DEMO = import.meta.env.RUNTIME_MODE === 'demo';

const onViewportChange = () => {
  cullOutOfViewport();
  sendViewport();
  updateAircraftCount(flights.size);
};

DOM.panelClose.addEventListener('click', deselectMarker);
map.on('moveend', onViewportChange);
map.on('zoomend', onViewportChange);

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

map.on('load', () => {
  if (IS_DEMO) {
    startDemo();
  } else {
    connectWS('/ws');
  }
});
