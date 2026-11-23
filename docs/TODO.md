# TODO

## Cleanup

- CI: fasttrack's `--affected` filters turbo with `[base...HEAD]`, which selects only changed packages, not their dependents. A change in `packages/shared` doesn't build, type-check or test the services and web app that use it; turbo's `...[base...HEAD]` would include them.
- api: search has no tests; it needs Redis (or a fake) to exercise the exact-match and prefix-index paths.

## Infra

- gateway: the `store`/`sub` Redis clients have no `error` listener, so ioredis prints an "Unhandled error event" stack trace on every failed reconnect.
- Promtail is deprecated in favor of Grafana Alloy.
- web: `maplibre-gl` codeSplitting group has no effect; everything lands in a 1 MB `vendor` chunk.
- Bun version drift: README 1.3.13, `packageManager` 1.3.14.
