import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_LAYER_URL = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';

export const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([52, 10], 2.5);

L.tileLayer(TILE_LAYER_URL, {
  attribution: '',
  maxZoom: 10,
}).addTo(map);

L.control.zoom({ position: 'bottomleft' }).addTo(map);
