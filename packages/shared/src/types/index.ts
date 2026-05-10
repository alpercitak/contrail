import { BBOX } from '../constants';

export interface FlightEvent {
  icao24: string; // unique aircraft identifier
  callsign: string; // e.g. KLM1234
  lat: number;
  lon: number;
  heading: number; // 0-360 degrees
  altitude: number; // meters
  speed: number; // km/h
  timestamp?: number; // unix ms
}

export interface SnapshotMessage {
  type: 'snapshot';
  flights: Array<FlightEvent>;
}

export interface UpdateMessage {
  type: 'update';
  flight: FlightEvent;
}

export type GatewayMessage = SnapshotMessage | UpdateMessage;

export type BBox = typeof BBOX;
