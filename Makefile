.PHONY: dev dev-docker redis-up redis-down

redis-up:
	docker compose up -d redis

redis-down:
	docker compose down redis

dev: redis-up
	bun run dev

dev-docker:
	docker compose --profile full up --build

dev-docker-down:
	docker compose --profile full down