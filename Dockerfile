FROM node:24-alpine AS build

WORKDIR /app

# Give npm/pnpm longer, resilient network settings for flaky connections.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000

# Install pnpm with a retry loop (home-server networks may reset connections).
RUN set -e; \
    for i in 1 2 3 4 5; do \
      if npm install --global pnpm@12.11.2; then \
        echo "pnpm installed on attempt $i"; \
        exit 0; \
      fi; \
      echo "attempt $i failed, sleeping..."; \
      sleep $((i * 15)); \
    done; \
    echo "pnpm install failed after 5 attempts"; \
    exit 1

COPY package.json pnpm-lock.yaml ./
RUN set -e; \
    for i in 1 2 3 4 5; do \
      if pnpm install --frozen-lockfile; then \
        echo "dependencies installed on attempt $i"; \
        exit 0; \
      fi; \
      echo "attempt $i failed, sleeping..."; \
      sleep $((i * 15)); \
    done; \
    echo "pnpm install failed after 5 attempts"; \
    exit 1

COPY index.html showcase.html vite.config.ts tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build:demo

FROM nginxinc/nginx-unprivileged:stable-alpine

ENV NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE=1
COPY --from=build --chown=101:101 /app/demo-dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
