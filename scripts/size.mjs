import { readFileSync } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";

const code = readFileSync("dist/triangle-toss.min.js");
const kb = (buffer) => `${(buffer.length / 1024).toFixed(2)} KiB`;
console.log(
  `Widget: ${kb(code)}; gzip: ${kb(gzipSync(code))}; brotli: ${kb(brotliCompressSync(code))}`,
);
