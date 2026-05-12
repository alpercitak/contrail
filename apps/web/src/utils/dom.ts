const mustGet = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element: ${id}`);
  }
  return el as T;
};

export const DOM = {
  map: mustGet<HTMLDivElement>('map'),

  panel: mustGet<HTMLDivElement>('panel'),
  panelClose: mustGet<HTMLButtonElement>('panel-close'),

  updates: mustGet<HTMLSpanElement>('updates'),
  statusAircrafts: mustGet<HTMLSpanElement>('status-aircrafts'),

  dot: mustGet<HTMLDivElement>('dot'),
  statusText: mustGet<HTMLSpanElement>('status-text'),

  callsign: mustGet<HTMLSpanElement>('p-callsign'),
  icao: mustGet<HTMLSpanElement>('p-icao'),
  alt: mustGet<HTMLSpanElement>('p-alt'),
  spd: mustGet<HTMLSpanElement>('p-spd'),
  hdg: mustGet<HTMLSpanElement>('p-hdg'),
  pos: mustGet<HTMLSpanElement>('p-pos'),
} as const;
