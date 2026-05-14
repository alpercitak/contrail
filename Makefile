.PHONY: redis-up observe-up dev dev-observe up down

redis-up:
	docker compose up -d redis

observe-up:
	docker compose up -d loki promtail grafana

dev: redis-up
	bun run dev

dev-observe: observe-up dev

build:
	bun run build
	
up:
	docker compose up --build --remove-orphans

down:
	docker compose down

load-test:
	cd k6 && bun run build && RUN_GATEWAY=true RUN_API=true k6 run dist/index.js