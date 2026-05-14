import type { Feed, FlightEvent } from '@contrail/shared/types';

interface FeedOpenskyConfig {
  clientId: string;
  clientSecret: string;
  tickMs: number;
}

interface OpenSkyResponse {
  states: Array<
    [
      string, // icao24
      string | null, // callsign
      string | null, // origin_country
      number | null, // time_position
      number, // last_contact
      number | null, // longitude
      number | null, // latitude
      number | null, // baro_altitude
      boolean, // on_ground
      number | null, // velocity
      number | null, // true_track
      number | null, // vertical_rate
    ]
  >;
}

const OPENSKY_API_URL = 'https://opensky-network.org/api/states/all';

const mapState = (state: OpenSkyResponse['states'][number]): FlightEvent | null => {
  const [
    icao24,
    callsign,
    _origin_country,
    time_position,
    last_contact,
    longitude,
    latitude,
    altitude,
    _on_ground,
    velocity,
    true_track,
    _vertical_rate,
  ] = state;

  if (latitude == null || longitude == null) {
    return null;
  }

  return {
    icao24,
    callsign: callsign?.trim() ?? '',
    lat: latitude,
    lon: longitude,
    altitude: altitude ?? 0,
    speed: velocity ?? 0,
    heading: true_track ?? 0,
    timestamp: time_position ?? last_contact ?? Date.now(),
  };
};

const getAuthorizationHeader = (config: FeedOpenskyConfig): string =>
  `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;

const isValidFlight = (flight: FlightEvent): boolean =>
  !!flight.callsign?.trim() && flight.speed > 50 && flight.heading !== 0;

export class FeedOpenSky implements Feed {
  private config: FeedOpenskyConfig;

  constructor(config: FeedOpenskyConfig) {
    this.config = config;
  }

  async fetch(): Promise<Array<FlightEvent>> {
    const res = await fetch(OPENSKY_API_URL, {
      headers: {
        Authorization: getAuthorizationHeader(this.config),
      },
    });

    if (!res.ok) {
      throw new Error(`[feed-opensky] fetch error: ${res.status}`);
    }

    const data = (await res.json()) as OpenSkyResponse;
    const events = (data.states ?? [])
      .map(mapState)
      .filter((e): e is FlightEvent => e !== null)
      .filter(isValidFlight);

    return events;
  }
}
