# TODO

## Infra

- gateway-lb: nginx resolves `gateway` once at startup, so a replica recreated with a new IP is unreachable until `gateway-lb` restarts. A `resolver 127.0.0.11` with a variable in `proxy_pass` (or nginx `server ... resolve`) would re-resolve.
