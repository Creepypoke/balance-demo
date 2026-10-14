import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

// Bootstrap serves ONLY the public CA certificate, never keys or project files.
const certificateDownload = () => ({
  name: "local-certificate-download",
  configureServer(server: import("vite").ViteDevServer) {
    const certificate = readFileSync(new URL("./.local-cert/rootCA.cer", import.meta.url));
    const download = createServer((request, response) => {
      if (request.url !== "/rootCA.cer" || !["GET", "HEAD"].includes(request.method ?? "")) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/x-x509-ca-cert",
        "Content-Disposition": 'attachment; filename="TriangleToss-Local-CA.cer"',
        "Content-Length": certificate.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : certificate);
    });
    download.on("error", (error) =>
      server.config.logger.error(
        `Не удалось запустить загрузку сертификата (5175): ${error.message}`,
      ),
    );
    download.listen(5175, "0.0.0.0");
    server.httpServer?.once("close", () => download.close());
  },
});

export default defineConfig(({ mode }) => ({
  plugins: mode === "https" ? [certificateDownload()] : [],
  server: {
    https:
      mode === "https"
        ? {
            key: readFileSync(new URL("./.local-cert/server.key", import.meta.url)),
            cert: readFileSync(new URL("./.local-cert/server.pem", import.meta.url)),
          }
        : undefined,
    fs: {
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.local-cert/**"],
    },
  },
  build:
    mode === "demo"
      ? {
          outDir: "demo-dist",
        }
      : {
          outDir: "dist",
          lib: {
            entry: "src/index.ts",
            name: "TriangleToss",
            formats: ["iife", "es"],
            fileName: (format) =>
              format === "iife" ? "triangle-toss.min.js" : "triangle-toss.es.js",
          },
          minify: "oxc",
          sourcemap: false,
          target: "es2020",
          reportCompressedSize: true,
        },
}));
