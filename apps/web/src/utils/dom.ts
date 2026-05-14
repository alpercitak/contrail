const mustGet = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element: ${id}`);
  }
  return el as T;
};

export const DOM = {
  panel: mustGet<HTMLDivElement>('panel'),
  panelClose: mustGet<HTMLButtonElement>('panel-close'),

  updateCount: mustGet<HTMLSpanElement>('updateCount'),
  aircraftCount: mustGet<HTMLSpanElement>('aircraftCount'),
  search: mustGet<HTMLInputElement>('search'),

  dot: mustGet<HTMLDivElement>('dot'),
  statusText: mustGet<HTMLSpanElement>('status-text'),

  callsign: mustGet<HTMLSpanElement>('p-callsign'),
  icao: mustGet<HTMLSpanElement>('p-icao'),
  alt: mustGet<HTMLSpanElement>('p-alt'),
  spd: mustGet<HTMLSpanElement>('p-spd'),
  hdg: mustGet<HTMLSpanElement>('p-hdg'),
  pos: mustGet<HTMLSpanElement>('p-pos'),
} as const;
