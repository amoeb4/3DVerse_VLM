import { WebSocketServer } from "ws";
import * as THREE from "three";

//Principal server.js

// ---------- Configuration des articulations ----------

// Ordre d'Euler utilisé par 3DVerse pour `eulerOrientation` (XYZ, XZY, YXZ, YZX, ZXY ou ZYX).
// Surchargeable en ligne de commande : --order=XYZ
const orderArg = process.argv.find((a) => a.startsWith("--order="));
const EULER_ORDER = orderArg ? orderArg.split("=")[1] : "ZYX";

// axis   : axe LOCAL de rotation de l'entité (x, y ou z)
// sign   : +1 ou -1 si le sens est inversé
// offset : décalage en degrés
// base   : orientation de repos [x, y, z] en degrés
const JOINTS = {
  part_1: { axis: "y", sign: 1, offset: 0, base: [90, 0, 180] },
  part_2: { axis: "z", sign: -1, offset: 0, base: [0, 90, 0] },
  part_3: { axis: "z", sign: 1, offset: 0, base: [0, 0, 0] },
  part_4: { axis: "x", sign: 1, offset: 0, base: [0, 0, 90] },
  part_5: { axis: "z", sign: -1, offset: 0, base: [0, 0, 160] },
  part_6: { axis: "x", sign: 1, offset: 0, base: [0, 0, 180] },
};

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const DEG = Math.PI / 180;

// Pré-calcul du quaternion de repos de chaque articulation
for (const cfg of Object.values(JOINTS)) {
  const [bx, by, bz] = cfg.base;
  cfg.qBase = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bx * DEG, by * DEG, bz * DEG, EULER_ORDER),
  );
}

// Retourne [x, y, z] en degrés (Euler absolu) pour `angleDeg` autour de l'axe local de l'articulation
function jointLocation(cfg, axis, angleDeg) {
  const qRot = new THREE.Quaternion().setFromAxisAngle(
    AXES[axis],
    angleDeg * DEG,
  );
  const q = cfg.qBase.clone().multiply(qRot); // rotation autour de l'axe LOCAL
  const e = new THREE.Euler().setFromQuaternion(q, EULER_ORDER);
  return [e.x / DEG, e.y / DEG, e.z / DEG];
}

// ---------- Serveur WebSocket ----------

const wss = new WebSocketServer({ port: 8767 });

console.log(
  `Server launched, awaiting message from client... (ordre d'Euler : ${EULER_ORDER})`,
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

wss.on("connection", (ws) => {
  console.log(`✅ Client connected (${wss.clients.size} total)`);

  ws.on("message", async (message) => {
    const text = message.toString();
    console.log("📨 Message received:", text);

    try {
      const data = JSON.parse(text);

      if (
        typeof data.name === "string" &&
        Array.isArray(data.location) &&
        (data.location.length === 3 || data.location.length === 4) &&
        data.location.every((n) => typeof n === "number")
      ) {
        console.log(`Request to move ${data.name} to ${data.location}`);
        for (const client of wss.clients) {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(data));
            await sleep(300);
          }
        }
      } else if (typeof data.select === "string") {
        console.log(`Request to select entity: ${data.select}`);

        for (const client of wss.clients) {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ select: data.select }));
            await sleep(300);
          }
        }
      } else {
        ws.send("Invalid message format");
      }
    } catch (err) {
      console.error("Error parsing message:", err);
      ws.send("Error: Invalid JSON");
    }
  });
  ws.on("close", () => {
    console.log(`❌ Client disconnected (${wss.clients.size - 1} remaining)`);
  });
});