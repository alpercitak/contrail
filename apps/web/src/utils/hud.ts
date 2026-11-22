import type { Status } from '../types';
import { DOM } from './dom';

let updateCount = 0;

export const incrementUpdates = (count: number) => {
  updateCount += count;
  DOM.updateCount.textContent = String(updateCount);
};

export const resetUpdates = () => {
  updateCount = 0;
  DOM.updateCount.textContent = '0';
};

export const updateAircraftCount = (count: number) => {
  DOM.aircraftCount.textContent = String(count);
};

export const setStatus = (status: Status) => {
  DOM.dot.className = 'status-dot';

  if (status === 'demo') {
    DOM.statusText.textContent = 'demo';
  } else if (status === 'online') {
    DOM.dot.classList.add('online');
    DOM.statusText.textContent = 'live';
  } else if (status === 'error') {
    DOM.dot.classList.add('error');
    DOM.statusText.textContent = 'disconnected';
  } else {
    DOM.statusText.textContent = 'connecting…';
  }
};
