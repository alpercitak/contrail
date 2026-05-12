import type { Status } from '../types';
import { DOM } from './dom';

let updateCount = 0;

const animateCount = (el: HTMLElement, target: number) => {
  const current = parseInt(el.textContent ?? '0');
  if (current >= target) {
    return;
  }
  el.textContent = String(current + 1);
  setTimeout(() => animateCount(el, target), 300);
};

export const incrementUpdates = () => {
  updateCount++;
  DOM.updates.textContent = String(updateCount);
};

export const resetUpdates = () => {
  updateCount = 0;
  DOM.updates.textContent = '0';
};

export const updateAircraftCount = (count: number) => {
  DOM.statusAircrafts.textContent = String(count);
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
