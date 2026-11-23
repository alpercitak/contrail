# TODO

## Cleanup

- CI: fasttrack's `--affected` filters turbo with `[base...HEAD]`, which selects only changed packages, not their dependents. A change in `packages/shared` doesn't build, type-check or test the services and web app that use it; turbo's `...[base...HEAD]` would include them.
- Tests cover only feed-mock and shared `inViewport`; add coverage for wire encode/decode, gateway cell routing, api search.

## Infra

- `.dockerignore` excludes `bun.lock`; images use `:latest` tags — builds aren't reproducible.
- Runtime images copy the whole root `node_modules`.
- Promtail is deprecated in favor of Grafana Alloy.
- web: `maplibre-gl` codeSplitting group has no effect; everything lands in a 1 MB `vendor` chunk.
- Bun version drift: README 1.3.13, `packageManager` 1.3.14.
