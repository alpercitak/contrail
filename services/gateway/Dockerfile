FROM oven/bun:latest AS build
WORKDIR /app
COPY . .
RUN bun install
RUN bun run build

FROM oven/bun:latest
WORKDIR /app
COPY --from=build /app/services/gateway/dist ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3001
CMD ["bun", "dist/index.js"]