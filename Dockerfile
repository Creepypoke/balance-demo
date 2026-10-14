FROM node:24-alpine AS build

WORKDIR /app
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html vite.config.ts tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build:demo

FROM nginxinc/nginx-unprivileged:stable-alpine

ENV NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE=1
COPY --from=build --chown=101:101 /app/demo-dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
