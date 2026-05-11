.PHONY: dev dev-docker redis-up redis-down

redis-up:
	docker compose up -d redis

redis-down:
	docker compose down redis

dev: redis-up
	bun run dev

docker-up:
	docker compose up --build --remove-orphans

docker-down:
	docker compose down