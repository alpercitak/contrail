FROM oven/bun:1.4.5 AS base
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.4.5
WORKDIR /app
COPY --from=base /app/services/api/dist ./dist
COPY --from=base /app/services/api/package.json ./package.json

EXPOSE 3002
CMD ["bun", "dist/index.js"]