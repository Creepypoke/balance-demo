import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

const directory = resolve(".local-cert");
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const file = (name) => resolve(directory, name);
const openssl = (...args) => execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
const ips = [
  ...new Set(
    Object.values(networkInterfaces())
      .flat()
      .filter(
        (entry) =>
          entry &&
          entry.family === "IPv4" &&
          !entry.internal &&
          /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
      )
      .map((entry) => entry.address),
  ),
];

try {
  if (!existsSync(file("rootCA.key")) && !existsSync(file("rootCA.pem"))) {
    openssl("genrsa", "-out", file("rootCA.key"), "2048");
    chmodSync(file("rootCA.key"), 0o600);
    openssl(
      "req",
      "-x509",
      "-new",
      "-sha256",
      "-days",
      "365",
      "-key",
      file("rootCA.key"),
      "-out",
      file("rootCA.pem"),
      "-subj",
      "/CN=TriangleToss Local Development CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE,pathlen:0",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    );
  }
  if (!existsSync(file("rootCA.key")) || !existsSync(file("rootCA.pem"))) {
    throw new Error(
      "Неполная пара rootCA.key/rootCA.pem. Проверьте .local-cert, не заменяйте CA без необходимости.",
    );
  }
  openssl("x509", "-checkend", "86400", "-noout", "-in", file("rootCA.pem"));
  openssl("x509", "-in", file("rootCA.pem"), "-outform", "DER", "-out", file("rootCA.cer"));
  openssl("genrsa", "-out", file("server.key"), "2048");
  chmodSync(file("server.key"), 0o600);
  openssl(
    "req",
    "-new",
    "-key",
    file("server.key"),
    "-out",
    file("server.csr"),
    "-subj",
    "/CN=localhost",
  );
  const san = ["DNS:localhost", "IP:127.0.0.1", "IP:::1", ...ips.map((ip) => `IP:${ip}`)].join(",");
  writeFileSync(
    file("server.ext"),
    `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`,
  );
  openssl(
    "x509",
    "-req",
    "-in",
    file("server.csr"),
    "-CA",
    file("rootCA.pem"),
    "-CAkey",
    file("rootCA.key"),
    "-CAcreateserial",
    "-out",
    file("server.pem"),
    "-days",
    "90",
    "-sha256",
    "-extfile",
    file("server.ext"),
  );
  openssl("verify", "-CAfile", file("rootCA.pem"), file("server.pem"));
  console.log("Локальные сертификаты готовы; системное хранилище доверия Mac не изменено.");
  for (const ip of ips) {
    console.log(`Игра: https://${ip}:5174/ | сертификат для iPhone: http://${ip}:5175/rootCA.cer`);
  }
} catch (error) {
  console.error("Не удалось создать HTTPS-сертификат:", error.message);
  if (error.stderr) console.error(error.stderr.toString());
  process.exitCode = 1;
}
