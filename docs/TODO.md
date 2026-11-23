# TODO

## Infra

- Service images are ~376 MB, almost all `oven/bun:1.4.5` (bundles are ~2 MB). The runtime stage could use `oven/bun:1.4.5-alpine` or `-distroless` (about half the compressed size); needs a `make up` run to confirm the bundles work there.
