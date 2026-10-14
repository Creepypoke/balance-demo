import { readFileSync, writeFileSync } from "node:fs";
import JavaScriptObfuscator from "javascript-obfuscator";

// Optional: avoid runtime-heavy control flow flattening and string decoding.
const source = readFileSync("dist/triangle-toss.min.js", "utf8");
const result = JavaScriptObfuscator.obfuscate(source, {
  compact: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  stringArray: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  sourceMap: false,
});
writeFileSync("dist/triangle-toss.obfuscated.min.js", result.getObfuscatedCode());
console.log("Created dist/triangle-toss.obfuscated.min.js (measure size before publishing).");
