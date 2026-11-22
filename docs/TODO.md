# TODO

## Bugs

- feed-opensky: `timestamp` is unix seconds but the feeder scores last-seen in ms, so every OpenSky flight is cleaned up as stale each tick. `speed` is m/s, type says km/h.
- feed-opensky: uses Basic auth with client id/secret; OpenSky API clients use an OAuth2 client-credentials token.
- feeder: passes `DEFAULT_TICK_MS` instead of `TICK_MS` to `FeedOpenSky`; async `setInterval` tick can overlap on slow fetches.
- feeder: `flight:history:<icao24>` lists are never deleted when a flight goes stale; old callsign index entries leak when a callsign changes.
- gateway: viewport bbox is unvalidated; a huge bbox makes `getCellsForBBox` loop forever. Clamp to ±90/±180 and reject NaN.
- gateway: `/health` reports `regionClients.size` (cells), not connected clients.
- gateway/web: no removal message — stale aircraft and aircraft leaving the viewport stay on the map until the next snapshot. `cullOutOfViewport`/`removeFlight` in `apps/web/src/utils/marker.ts` are unused.
- docker-compose: Loki mounts `/etc/loki/config.yml` but runs with `/etc/loki/local-config.yaml`.

## Cleanup

- web: `src/types/index.ts` imports `leaflet` (leftover from migration); `MarkerEntry`/`InterpolationState` are dead.
- README: WebSocket example shows object JSON; gateway only accepts `["v", [latMin, latMax, lonMin, lonMax]]`.
- Add a typecheck task (services build with `bun build`, which skips type checking) and run tests + typecheck in CI.
- Tests only cover feed-mock; add coverage for wire encode/decode, gateway cell routing, api search.

## Infra

- `.dockerignore` excludes `bun.lock`; images use `:latest` tags — builds aren't reproducible.
- Runtime images copy the whole root `node_modules`.
- Promtail is deprecated in favor of Grafana Alloy.
- Stadia Maps style needs an API key outside localhost.
- web: `maplibre-gl` codeSplitting group has no effect; everything lands in a 1 MB `vendor` chunk.
- Bun version drift: README 1.3.13, `packageManager` 1.3.14.
