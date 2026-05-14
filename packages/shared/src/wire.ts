import type { BoundingBox, FlightEvent, GatewayMessage } from './types';

export type WireFlight = [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number?,
];

export type WireBBox = [number, number, number, number];

export type WireSnapshotMessage = ['s', Array<WireFlight>];
export type WireUpdateMessage = ['u', WireFlight];
export type WireViewportMessage = ['v', WireBBox];
export type WireBatchMessage = ['b', Array<WireFlight>];

export type WireGatewayMessage =
  | WireSnapshotMessage
  | WireUpdateMessage
  | WireViewportMessage
  | WireBatchMessage;

export const encodeFlight = (flight: FlightEvent): WireFlight => [
  flight.icao24,
  flight.callsign,
  flight.lat,
  flight.lon,
  flight.heading,
  flight.altitude,
  flight.speed,
  flight.timestamp,
];

export const decodeFlight = (flight: WireFlight): FlightEvent => ({
  icao24: flight[0],
  callsign: flight[1],
  lat: flight[2],
  lon: flight[3],
  heading: flight[4],
  altitude: flight[5],
  speed: flight[6],
  timestamp: flight[7],
});

export const encodeBBox = (bbox: BoundingBox): WireBBox => [
  bbox.latMin,
  bbox.latMax,
  bbox.lonMin,
  bbox.lonMax,
];

export const decodeBBox = (bbox: WireBBox): BoundingBox => ({
  latMin: bbox[0],
  latMax: bbox[1],
  lonMin: bbox[2],
  lonMax: bbox[3],
});

export const encodeGatewayMessage = (msg: GatewayMessage): WireGatewayMessage => {
  switch (msg.type) {
    case 'snapshot':
      return ['s', msg.flights.map(encodeFlight)];
    case 'update':
      return ['u', encodeFlight(msg.flight)];
    case 'viewport':
      return ['v', encodeBBox(msg.bbox)];
    case 'batch':
      return ['b', msg.flights.map(encodeFlight)];
  }
};

export const decodeGatewayMessage = (msg: WireGatewayMessage): GatewayMessage => {
  switch (msg[0]) {
    case 's':
      return { type: 'snapshot', flights: msg[1].map(decodeFlight) };
    case 'u':
      return { type: 'update', flight: decodeFlight(msg[1]) };
    case 'v':
      return { type: 'viewport', bbox: decodeBBox(msg[1]) };
    case 'b':
      return { type: 'batch', flights: msg[1].map(decodeFlight) };
  }
};
