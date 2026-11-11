// Makes a self-signed cert in ssl/ so `npm run dev` serves https: WebXR needs a secure
// context, and plain http on a LAN IP (a headset on http://192.168.x.x:5173) is not one.
// The cert covers localhost and every IPv4 address of this machine; rerun it when the IP changes.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4")
  .map((a) => a.address);
const san = ["DNS:localhost", ...new Set(ips)].map((n) =>
  n.startsWith("DNS:") ? n : `IP:${n}`,
);

mkdirSync("ssl", { recursive: true });
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "825",
    "-subj",
    "/CN=3dverse-vlm-dev",
    "-keyout",
    "ssl/key.pem",
    "-out",
    "ssl/cert.pem",
    "-addext",
    `subjectAltName=${san.join(",")}`,
  ],
  { stdio: "inherit" },
);
console.log(`ssl/cert.pem covers: ${san.join(", ")}`);
