import { setTrailData } from './map';
import { scheduleMapDataRender } from './render-scheduler';

const TRAIL_LENGTH = 12;
const trailPositions = new Map<string, [number, number][]>();

const renderTrails = () => {
  const features: Array<GeoJSON.Feature> = [];
  for (const [icao24, positions] of trailPositions) {
    if (positions.length < 2) {
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: positions },
      properties: { icao24 },
    });
  }
  setTrailData(features);
};

export const addTrailPoint = (icao24: string, lon: number, lat: number) => {
  const positions = trailPositions.get(icao24) ?? [];
  positions.push([lon, lat]);
  if (positions.length > TRAIL_LENGTH) {
    positions.shift();
  }
  trailPositions.set(icao24, positions);
  scheduleMapDataRender(renderTrails);
};

export const removeTrail = (icao24: string) => {
  trailPositions.delete(icao24);
  scheduleMapDataRender(renderTrails);
};
