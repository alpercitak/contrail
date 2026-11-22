# TODO

## Bugs

- feeder + OpenSky: a 5s tick on `/states/all` (4 credits per call) exceeds OpenSky's daily credit allowance within hours; OpenSky mode needs a much longer `TICK_MS` or a bbox-limited query.
- feeder: deleting `flight:by:callsign` on callsign change or staleness can drop the mapping of another aircraft sharing that callsign (search still finds it via the prefix index).
- gateway/web: viewports crossing the antimeridian (MapLibre west < -180 or east > 180) are clamped, so aircraft on the wrapped side aren't streamed.

## Cleanup

- web: `src/types/index.ts` imports `leaflet` (leftover from migration); `MarkerEntry`/`InterpolationState` are dead.
- web: declare and import GeoJSON types so they resolve during standalone TypeScript checks.
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
