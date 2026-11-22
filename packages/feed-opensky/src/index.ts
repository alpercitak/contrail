import type { Feed, FlightEvent } from '@contrail/shared/types';

interface FeedOpenskyConfig {
  clientId: string;
  clientSecret: string;
}

interface OpenSkyResponse {
  states: Array<
    [
      string, // icao24
      string | null, // callsign
      string | null, // origin_country
      number | null, // time_position (unix s)
      number, // last_contact (unix s)
      number | null, // longitude
      number | null, // latitude
      number | null, // baro_altitude (m)
      boolean, // on_ground
      number | null, // velocity (m/s)
      number | null, // true_track
      number | null, // vertical_rate
    ]
  > | null;
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
}

const OPENSKY_API_URL = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const MIN_SPEED_KMH = 180;

const mapState = (state: NonNullable<OpenSkyResponse['states']>[number]): FlightEvent | null => {
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
    speed: (velocity ?? 0) * 3.6,
    heading: true_track ?? 0,
    timestamp: (time_position ?? last_contact) * 1000,
  };
};

const isValidFlight = (flight: FlightEvent): boolean =>
  !!flight.callsign && flight.speed > MIN_SPEED_KMH && flight.heading !== 0;

export class FeedOpenSky implements Feed {
  private config: FeedOpenskyConfig;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: FeedOpenskyConfig) {
    this.config = config;
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.value;
    }

    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`[feed-opensky] token error: ${res.status}`);
    }

    const data = (await res.json()) as TokenResponse;
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS };
    return this.token.value;
  }

  async fetch(): Promise<Array<FlightEvent>> {
    const res = await fetch(OPENSKY_API_URL, {
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
      },
    });

    if (res.status === 401) {
      this.token = null;
    }

    if (!res.ok) {
      throw new Error(`[feed-opensky] fetch error: ${res.status}`);
    }

    const data = (await res.json()) as OpenSkyResponse;
    return (data.states ?? [])
      .map(mapState)
      .filter((e): e is FlightEvent => e !== null)
      .filter(isValidFlight);
  }
}
