.PHONY: redis-up observe-up dev dev-observe up down

redis-up:
	docker compose up -d redis

observe-up:
	docker compose up -d loki promtail grafana

dev: redis-up
	bun run dev

dev-observe: observe-up dev

up:
	docker compose up --build --remove-orphans

down:
	docker compose down