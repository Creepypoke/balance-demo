# Build the static site first: pnpm install --frozen-lockfile && pnpm run build:demo
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --chown=101:101 demo-dist/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
