FROM node:26 AS build

WORKDIR /app
COPY . .
RUN npm install -g bun
RUN bun install

RUN bun run build --cwd apps/web

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80