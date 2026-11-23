# Contrail

Bun + Turbo monorepo: a real-time aircraft radar. Feeder writes flight state to Redis, gateway fans it out over viewport-aware WebSockets, api serves search/history, web renders it on a MapLibre map.

- Use Bun for dependencies and package scripts. Shared dependency versions live in the root `package.json` `catalog`.
- Import across workspaces via `@contrail/<package>` (e.g. `@contrail/shared/types`), never relative paths.
- For review, diagnosis, or planning, inspect only. For implementation, preserve unrelated user changes.

## Layout

- `services/{feeder,gateway,api}/src/index.ts`: single-file Bun services (Fastify + ioredis). Tuning values are top-of-file constants; env vars fall back to `@contrail/shared/constants`. Pure logic worth unit-testing moves to a sibling module (e.g. `gateway/src/grid.ts`) because importing `index.ts` starts the server.
- `packages/shared`: `FlightEvent`/message types, Redis keys and defaults (`constants/`), wire encode/decode (`wire.ts`). Any message-shape change goes through `wire.ts` and must stay compatible with web, gateway, and k6.
- `packages/feed-mock`, `packages/feed-opensky`: implement the `Feed` interface. `packages/logger`: shared pino logger.
- `apps/web/src/`: `main.ts` wires events; `utils/` holds one concern per file (`map`, `marker`, `trail`, `ws`, `worker`, `hud`, …). The WebSocket lives in `utils/worker.ts`; the main thread only sees shaped flights.
- `k6/`: load tests (separate lockfile). `observability/`: Grafana, Loki, Alloy config for Docker Compose.
- Packages export from `dist/`, so run `bun run build` before running services that depend on changed packages.

## Implementation

Treat additional code as a cost.
Smallest change that solves the actual task.
Follow existing patterns.
No hypothetical future requirements, no unrelated refactors, no wrapper/factory/dependency for a single use unless it removes concrete complexity today.
Small duplication beats premature abstraction.
Default, not absolute — if the task genuinely needs structure, build it and say why in one line.
Scope is the task, nothing more.
Worth doing but out of scope → mention it, don't implement it.
If the issue is ambiguous, follow existing convention.

## Defensive Programming

Trust internal TypeScript invariants. No assertions/guards/validation/fallbacks for states this codebase already controls, unless you can name the concrete failure prevented. Validate only at real trust boundaries: WebSocket messages from clients, HTTP query/params, external feed responses, data read back from Redis. Handle errors only with a real recovery path — otherwise let them propagate. Don't invent recovery, don't swallow, don't build infra for it.

## TypeScript

Precise types over runtime checks — no `any`, no unnecessary assertions, no non-null assertions where the type can be modeled correctly. Keep hot paths (gateway batching/fan-out, worker ingest, map render) allocation-light and avoid per-message work that can be done per batch.

## Stopping

Implement, verify with checks, stop. Don't keep hardening or generalizing once it's done — note anything extra you noticed, don't build it.

## Before Finishing

Verify with `bun run build`, `bun run test`, and `bun run check` (Biome).
Keep `docs/TODO.md` updated: remove completed work and add newly identified remaining work.
Commit in small, feature-based Conventional Commits (`fix(gateway): …`, `refactor(web): …`); no attribution trailers.
Cut from your own diff: unneeded abstractions, redundant guards, one-use helpers, speculative config, unrelated changes, obvious-code comments. Equal correctness → ship the smaller one.
