// server.js — serveur WebSocket (port 8767) qui reçoit directement le flux gRPC
// du serveur Python (mouvements simulés du robot) et le diffuse au navigateur.
//
//   server.py (gRPC) ──► server.js ──► webSockets.tsx (navigateur)
//
// Le navigateur n'est PAS modifié : il reçoit { name, location:[x,y,z] } (Euler absolu, degrés)
// et fait `eulerOrientation = location`. Pour éviter le blocage de cardan (X et Z identiques
// quand Y = 90°), on ne fait plus "base + angle" sur une composante d'Euler :
// le serveur compose les rotations en quaternions, puis convertit en Euler.
//
//   q_final = q_base × rotation(axe local, angle)   →   Euler (EULER_ORDER)   →   location
//
// Mode test :  node server.js --sweep=part_2 [--order=XYZ]
//
// npm i @grpc/grpc-js @grpc/proto-loader ws three   (+ "type": "module" dans package.json)

import { WebSocketServer } from 'ws';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import * as THREE from 'three';

const WS_PORT = 8767;
const GRPC_ADDR = 'localhost:50051';   // ou '192.168.10.75:50051' si Python tourne ailleurs
const RATE_HZ = 30;

// Ordre d'Euler utilisé par 3DVerse pour `eulerOrientation` (XYZ, XZY, YXZ, YZX, ZXY ou ZYX).
// Ton code utilise "ZYX" dans applyStepRotation : c'est la valeur par défaut ici.
// Surchargeable en ligne de commande : --order=XYZ
const orderArg = process.argv.find((a) => a.startsWith('--order='));
const EULER_ORDER = orderArg ? orderArg.split('=')[1] : 'ZYX';

// axis   : axe LOCAL de rotation de l'entité (x, y ou z) — à trouver avec --sweep
// sign   : +1 ou -1 si le sens est inversé
// offset : décalage en degrés
// base   : orientation de repos [x, y, z] en degrés (celle que tu as déjà validée)
const JOINTS = {
  part_1: { axis: 'y', sign: 1, offset: 0, base: [90, 0, 180] },
  part_2: { axis: 'z', sign: -1, offset: 0, base: [0, 90, 0] },
  part_3: { axis: 'z', sign: 1, offset: 0, base: [0, 0, -270] },
  part_4: { axis: 'x', sign: 1, offset: 0, base: [0, 0, 90] },
  part_5: { axis: 'z', sign: -1, offset: 0, base: [0, 0, 160] },
  part_6: { axis: 'x', sign: 1, offset: 0, base: [0, 0, 180] },
};
const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
const DEG = Math.PI / 180;
const EPSILON_DEG = 0.01;
const lastSent = {};

// Pré-calcul du quaternion de repos de chaque articulation
for (const cfg of Object.values(JOINTS)) {
  const [bx, by, bz] = cfg.base;
  cfg.qBase = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bx * DEG, by * DEG, bz * DEG, EULER_ORDER)
  );
}

// Retourne [x, y, z] en degrés (Euler absolu) pour `angleDeg` autour de l'axe local de l'articulation
function jointLocation(cfg, axis, angleDeg) {
  const qRot = new THREE.Quaternion().setFromAxisAngle(AXES[axis], angleDeg * DEG);
  const q = cfg.qBase.clone().multiply(qRot);          // rotation autour de l'axe LOCAL
  const e = new THREE.Euler().setFromQuaternion(q, EULER_ORDER);
  return [e.x / DEG, e.y / DEG, e.z / DEG];
}

// ---------- Serveur WebSocket ----------
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`Server launched on ws://localhost:${WS_PORT} (ordre d'Euler : ${EULER_ORDER})`);

function broadcast(text) {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(text);
  }
}

wss.on('connection', (ws) => {
  console.log(`✅ Client connected (${wss.clients.size} total)`);
  ws.on('message', (m) => console.log('📨', m.toString()));
  ws.on('close', () => console.log(`❌ Client disconnected (${wss.clients.size} remaining)`));
});

// ---------- Client gRPC ----------
const def = protoLoader.loadSync('./robot.proto', { keepCase: true, longs: Number, defaults: true });
const { robot } = grpc.loadPackageDefinition(def);

function startGrpcStream() {
  const client = new robot.RobotStream(GRPC_ADDR, grpc.credentials.createInsecure());
  const call = client.StreamJoints({ rate_hz: RATE_HZ });
  console.log(`🔌 Connexion gRPC vers ${GRPC_ADDR}...`);

  call.on('data', (state) => {
    for (const j of state.joints) {
      const cfg = JOINTS[j.name];
      if (!cfg) continue;
      if (Math.abs((lastSent[j.name] ?? Infinity) - j.angle_deg) < EPSILON_DEG) continue;
      lastSent[j.name] = j.angle_deg;
      const location = jointLocation(cfg, cfg.axis, cfg.sign * j.angle_deg + cfg.offset);
      broadcast(JSON.stringify({ name: j.name, location }));
    }
  });

  let retrying = false;
  const retry = (why) => {
    if (retrying) return;
    retrying = true;
    console.error(`gRPC: ${why} — nouvelle tentative dans 2s`);
    setTimeout(startGrpcStream, 2000);
  };
  call.on('error', (e) => retry(e.message));
  call.on('end', () => retry('flux terminé'));
}

const sweepArg = process.argv.find((a) => a.startsWith('--sweep='));
if (sweepArg) {
  const name = sweepArg.split('=')[1];
  const cfg = JOINTS[name];
  const axes = ['x', 'y', 'z'];
  let lastAxis = null;
  const t0 = Date.now();
  setInterval(() => {
    const t = (Date.now() - t0) / 1000;
    const axis = axes[Math.floor(t / 2) % 3];
    if (axis !== lastAxis) {
      console.log(`🧪 ${name} : oscillation autour de l'axe local ${axis} (ordre ${EULER_ORDER})`);
      lastAxis = axis;
    }
    broadcast(JSON.stringify({ name, location: jointLocation(cfg, axis, 40 * Math.sin(t * 2)) }));
  }, 33);
} else {
  startGrpcStream();
}