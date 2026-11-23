FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=build /app/services/feeder/dist ./dist

CMD ["bun", "dist/index.js"]