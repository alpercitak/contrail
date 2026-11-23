# TODO

## Infra

- web: its nginx (`apps/web/nginx.conf`) proxies `/api` to `api:3002` and `/ws` to `gateway-lb`, resolved once at startup. A recreated `api` or `gateway-lb` with a new IP breaks the proxy until `web` restarts; the same `resolver` + `upstream ... resolve` fix as `services/gateway/nginx.conf` applies.
