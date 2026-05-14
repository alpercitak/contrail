export interface Feed {
  fetch(): Promise<Array<FlightEvent>>;
}

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

export interface BoundingBox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  flights: Array<FlightEvent>;
}

export interface UpdateMessage {
  type: 'update';
  flight: FlightEvent;
}

export interface ViewportMessage {
  type: 'viewport';
  bbox: BoundingBox;
}

export interface BatchMessage {
  type: 'batch';
  flights: Array<FlightEvent>;
}

export type GatewayMessage = SnapshotMessage | UpdateMessage | ViewportMessage | BatchMessage;
