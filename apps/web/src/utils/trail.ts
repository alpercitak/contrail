import L from 'leaflet';
import { map } from './map';

const TRAIL_LENGTH = 10;

const trails = new Map<string, L.Polyline>();
const trailPositions = new Map<string, [number, number][]>();

const addTrailPoint = (icao24: string, lat: number, lon: number) => {
  const positions = trailPositions.get(icao24) ?? [];
  positions.push([lat, lon]);
  if (positions.length > TRAIL_LENGTH) {
    positions.shift();
  }
  trailPositions.set(icao24, positions);

  const existing = trails.get(icao24);
  if (existing) {
    existing.setLatLngs(positions);
  } else {
    const line = L.polyline(positions, {
      color: '#00d4ff',
      weight: 1,
      opacity: 0.4,
    }).addTo(map);
    trails.set(icao24, line);
  }
};

const removeTrail = (icao24: string) => {
  trails.get(icao24)?.remove();
  trails.delete(icao24);
  trailPositions.delete(icao24);
};

export { addTrailPoint, removeTrail };
