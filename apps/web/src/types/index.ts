import type L from 'leaflet';
import type { FlightEvent } from '@contrail/shared';

export type MarkerEntry = {
  marker: L.Marker;
  el: HTMLDivElement;
  flight: FlightEvent;
};

export type Status = 'online' | 'connecting' | 'error' | 'demo';

export type InterpolationState = {
  fromLat: number;
  fromLon: number;
  fromHeading: number;
  toLat: number;
  toLon: number;
  toHeading: number;
  startTime: number;
  rafId: number;
};
