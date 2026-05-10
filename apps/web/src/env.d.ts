import type MapLibre from 'maplibre-gl';

declare global {
  const maplibregl: typeof MapLibre;
}
