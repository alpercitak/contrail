import { DOM } from './dom';

let updateCount = 0;

const incrementUpdates = () => {
  updateCount++;
  DOM.updates.textContent = String(updateCount);
};

const resetUpdates = () => {
  updateCount = 0;
  DOM.updates.textContent = '0';
};

const updateAircraftCount = (count: number) => {
  DOM.statusAircrafts.textContent = String(count);
};

export { incrementUpdates, resetUpdates, updateAircraftCount };
