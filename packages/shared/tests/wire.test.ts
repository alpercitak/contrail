import type { FlightEvent, GatewayMessage } from '../src/types';
import { decodeGatewayMessage, encodeGatewayMessage } from '../src/wire';
import { describe, expect, test } from 'bun:test';

const flight: FlightEvent = {
  icao24: '3c6444',
  callsign: 'DLH9LF',
  lat: 50.03,
  lon: 8.56,
  heading: 270,
  altitude: 10668,
  speed: 830,
  timestamp: 1_795_000_000_000,
};

const { timestamp: _, ...untimed } = flight;

// What actually crosses the socket: encode, serialize, parse, decode.
const roundTrip = (msg: GatewayMessage) => decodeGatewayMessage(JSON.parse(JSON.stringify(encodeGatewayMessage(msg))));

describe('wire', () => {
  test('encodes a flight as a positional array', () => {
    expect(encodeGatewayMessage({ type: 'update', flight })).toEqual([
      'u',
      ['3c6444', 'DLH9LF', 50.03, 8.56, 270, 10668, 830, 1_795_000_000_000],
    ]);
  });

  test('encodes a viewport as [latMin, latMax, lonMin, lonMax]', () => {
    expect(
      encodeGatewayMessage({ type: 'viewport', bbox: { latMin: 40, latMax: 55, lonMin: -5, lonMax: 15 } }),
    ).toEqual(['v', [40, 55, -5, 15]]);
  });

  const messages: Array<[string, GatewayMessage]> = [
    ['snapshot', { type: 'snapshot', flights: [flight, untimed] }],
    ['update', { type: 'update', flight }],
    ['viewport', { type: 'viewport', bbox: { latMin: -50, latMax: -10, lonMin: 165, lonMax: 195 } }],
    ['batch', { type: 'batch', flights: [flight] }],
    ['empty batch', { type: 'batch', flights: [] }],
    ['remove', { type: 'remove', icao24s: ['3c6444', 'a1b2c3'] }],
  ];

  for (const [name, msg] of messages) {
    test(`round-trips ${name}`, () => {
      expect(roundTrip(msg)).toEqual(msg);
    });
  }
});
