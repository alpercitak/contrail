FROM oven/bun:1.4.5 AS build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

RUN bun run build --cwd apps/web

FROM nginx:1.31.9-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80