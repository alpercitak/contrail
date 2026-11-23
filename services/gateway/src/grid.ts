import type { BoundingBox } from '@contrail/shared/types';

// Viewport routing grid: flights and viewports map to GRID_SIZE-degree cells.
const GRID_SIZE = 5;
const GRID_COLUMNS = 360 / GRID_SIZE;

// Column index wrapped into [-180, 180) so cells on both sides of the antimeridian line up.
const getColumn = (x: number) =>
  ((((x + GRID_COLUMNS / 2) % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS) - GRID_COLUMNS / 2;

export const getCellId = (lat: number, lon: number) =>
  `${getColumn(Math.floor(lon / GRID_SIZE))}:${Math.floor(lat / GRID_SIZE)}`;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Client-supplied bbox: reject non-numbers and inverted ranges, clamp latitude, and shift longitude so lonMin is in
// [-180, 180) while keeping the width (capped at one world), so the cell loop stays bounded across the antimeridian.
export const toValidBBox = (bbox: BoundingBox): BoundingBox | null => {
  if (![bbox.latMin, bbox.latMax, bbox.lonMin, bbox.lonMax].every(Number.isFinite) || bbox.lonMin > bbox.lonMax) {
    return null;
  }
  const width = Math.min(bbox.lonMax - bbox.lonMin, 360);
  const lonMin = ((((bbox.lonMin + 180) % 360) + 360) % 360) - 180;
  return {
    latMin: clamp(bbox.latMin, -90, 90),
    latMax: clamp(bbox.latMax, -90, 90),
    lonMin,
    lonMax: lonMin + width,
  };
};

export const getCellsForBBox = (bbox: BoundingBox) => {
  const cells = new Set<string>();

  const minX = Math.floor(bbox.lonMin / GRID_SIZE);
  const maxX = Math.floor(bbox.lonMax / GRID_SIZE);
  const minY = Math.floor(bbox.latMin / GRID_SIZE);
  const maxY = Math.floor(bbox.latMax / GRID_SIZE);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      cells.add(`${getColumn(x)}:${y}`);
    }
  }

  return [...cells];
};
