FROM oven/bun:1.4.2 AS base
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=base /app/services/api/dist ./dist
COPY --from=base /app/services/api/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3002
CMD ["bun", "dist/index.js"]