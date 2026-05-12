import type { FlightEvent } from '@contrail/shared/types';
import { DOM } from './dom';

const updatePanel = (flight: FlightEvent) => {
  DOM.callsign.textContent = flight.callsign;
  DOM.icao.textContent = flight.icao24;
  DOM.alt.textContent = `${Math.round(flight.altitude).toLocaleString()} m`;
  DOM.spd.textContent = `${Math.round(flight.speed)} km/h`;
  DOM.hdg.textContent = `${Math.round(flight.heading)}°`;
  DOM.pos.textContent = `${flight.lat.toFixed(2)}, ${flight.lon.toFixed(2)}`;
};

const showPanel = () => {
  DOM.panel.classList.add('visible');
};

const hidePanel = () => {
  DOM.panel.classList.remove('visible');
};

export { updatePanel, showPanel, hidePanel };
