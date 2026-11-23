FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=build /app/services/gateway/dist ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3001
CMD ["bun", "dist/index.js"]