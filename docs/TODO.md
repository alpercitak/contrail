# TODO

## Cleanup

- README: WebSocket example shows object JSON; gateway only accepts `["v", [latMin, latMax, lonMin, lonMax]]`.
- Add a typecheck task (services build with `bun build`, which skips type checking) and run tests + typecheck in CI.
- Tests only cover feed-mock; add coverage for wire encode/decode, gateway cell routing, api search.

## Infra

- `.dockerignore` excludes `bun.lock`; images use `:latest` tags — builds aren't reproducible.
- Runtime images copy the whole root `node_modules`.
- Promtail is deprecated in favor of Grafana Alloy.
- web: `maplibre-gl` codeSplitting group has no effect; everything lands in a 1 MB `vendor` chunk.
- Bun version drift: README 1.3.13, `packageManager` 1.3.14.
