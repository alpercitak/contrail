import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json',
  center: [10, 52],
  zoom: 4,
  minZoom: 3,
  maxZoom: 14,
  attributionControl: false,
});

map.addControl(new maplibregl.NavigationControl(), 'bottom-left');

const AIRCRAFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="white" d="M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5L10,9L2,14L2,16L10,13.5L10,19L8,20.5L8,22L11.5,21L15,22L15,20.5L13,19L13,13.5L21,16Z"/>
</svg>`;

const loadAircraftIcon = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const img = new Image(36, 36);
    img.onload = () => {
      map.addImage('aircraft-icon', img, { sdf: true });
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(AIRCRAFT_SVG)}`;
  });

map.on('load', async () => {
  await loadAircraftIcon();

  map.addSource('aircraft', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addSource('trails', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'trails',
    type: 'line',
    source: 'trails',
    paint: {
      'line-color': '#00d4ff',
      'line-width': 1,
      'line-opacity': 0.35,
    },
  });

  map.addLayer({
    id: 'aircraft-selected',
    type: 'circle',
    source: 'aircraft',
    filter: ['==', ['get', 'icao24'], ''],
    paint: {
      'circle-radius': 14,
      'circle-color': 'transparent',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#f59e0b',
      'circle-stroke-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'aircraft',
    type: 'symbol',
    source: 'aircraft',
    layout: {
      'icon-image': 'aircraft-icon',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 0.8, 12, 1.2],
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-color': [
        'case',
        ['<', ['get', 'altitude'], 3000],
        '#f59e0b',
        ['<', ['get', 'altitude'], 8000],
        '#22c55e',
        '#00d4ff',
      ],
      'icon-opacity': 0.9,
      'icon-halo-color': 'rgba(0,0,0,0.5)',
      'icon-halo-width': 1,
    },
  });
});

export const setAircraftData = (features: Array<GeoJSON.Feature>) => {
  const source = map.getSource('aircraft') as maplibregl.GeoJSONSource;
  source?.setData({ type: 'FeatureCollection', features });
};

export const setTrailData = (features: Array<GeoJSON.Feature>) => {
  const source = map.getSource('trails') as maplibregl.GeoJSONSource;
  source?.setData({ type: 'FeatureCollection', features });
};

export const setSelectedFilter = (icao24: string) => {
  map.setFilter('aircraft-selected', ['==', ['get', 'icao24'], icao24]);
};

export const clearSelectedFilter = () => {
  map.setFilter('aircraft-selected', ['==', ['get', 'icao24'], '']);
};
