import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname } from "path";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = __dirname + "/cnc.proto";
const GRPC_ADDRESS = "192.168.214.252:50051";
const WS_URL = "ws://localhost:8767";
const POLL_INTERVAL_MS = 33;
const NB_AXES = 8;

// Modes de diagnostic (variables d'environnement) :
//   PROBE=1      -> appelle ReadHeader et readAquisition au démarrage et affiche leur contenu
//   DEBUG_DUMP=1 -> affiche les index de ReadData dont la valeur change (bouge un axe à la fois)
const PROBE = process.env.PROBE === "1";
const DEBUG_DUMP = process.env.DEBUG_DUMP === "1";

// Chargement du proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const CLMService: any = protoDescriptor.CLMService;

const client: any = new CLMService(GRPC_ADDRESS, grpc.credentials.createInsecure());
if (!client) console.error("❌ Impossible de créer le client gRPC");

// Connexion WebSocket
const ws = new WebSocket(WS_URL);

// Dernière localisation envoyée pour chaque part (pour n'envoyer que les changements)
const lastSent = new Map<string, string>();

ws.on("open", () => {
  console.log("🔗 Connected to WebSocket server");
  lastSent.clear(); // renvoie tout l'état à la (re)connexion
});
ws.on("close", () => console.log("🔌 WebSocket fermé"));
ws.on("error", (e) => console.error("❌ WebSocket error:", e));

//Axe 1= 0
//Axe 2= 0
//Axe 3= -83
//Axe 4= 0
//Axe 5= 0
//Axe 6= 0
//Axe 7= -119
//Axe 8= 0

// Version actuelle (valeur brute, sans signe ni offset).
// Variante avec signes/offsets si ta scène 3D le demande :
//   1: (val) => [90, 0, -val],
//   2: (val) => [-90, -val + 270, 90],
//   3: (val) => [0, 0, val - 180],
//   4: (val) => [-val, 0, 90],
//   5: (val) => [-180, 0, -val + 180],
//   6: (val) => [-val + 180, 0, 180],
//   7: (val) => [0, 0, -val],
//   8: (val) => [-val, 0, 0],
const orientationMap: Record<number, (val: number) => [number, number, number]> = {
  // robot
  1: (val) => [90, 0, val],
  2: (val) => [-90, val, 90],
  3: (val) => [0, 0, val],
  4: (val) => [val, 0, 90],
  5: (val) => [-180, 0, val],
  6: (val) => [val, 0, 180],
  // Vireur
  7: (val) => [0, 0, val],
  8: (val) => [val, 0, 0],
};

// values[0] est un int (compteur/timestamp ?), les axes sont lus à partir de values[1].
// ATTENTION : ReadRequest est vide, donc c'est le serveur qui décide ce que contient
// values[1..8]. Ce ne sont des angles d'axes que si le serveur les publie ainsi.
function parsePartsFromResponse(response: any): { name: string; location: number[] }[] {
  const values = response?.values;
  if (!Array.isArray(values)) return [];

  const parts: { name: string; location: number[] }[] = [];
  for (let i = 1; i <= NB_AXES; i++) {
    const v = values[i]?.float_value;
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    parts.push({ name: `part_${i}`, location: orientationMap[i](v) });
  }
  return parts;
}

// N'envoie que ce qui a changé, y compris un retour à [0,0,0]
function sendChanges(parts: { name: string; location: number[] }[]) {
  if (ws.readyState !== WebSocket.OPEN) return;

  parts.forEach((msg) => {
    const key = JSON.stringify(msg.location);
    if (lastSent.get(msg.name) === key) return; // inchangé
    lastSent.set(msg.name, key);
    ws.send(JSON.stringify(msg));
    console.log("📨 Sent:", msg);
  });
}

// Diagnostic : affiche les index de ReadData qui changent
let prevValues: (number | undefined)[] = [];
function dumpChanges(values: any[]) {
  const cur = values.map((v) => v.float_value ?? v.int_value);
  cur.forEach((v, i) => {
    if (v !== prevValues[i]) console.log(`[${i}] ${prevValues[i]} -> ${v}`);
  });
  prevValues = cur;
}

// Appel gRPC unaire sous forme de promesse
function call(method: string): Promise<any> {
  return new Promise((resolve, reject) => {
    client[method]({}, (err: any, res: any) => (err ? reject(err) : resolve(res)));
  });
}

// Diagnostic : teste les autres RPC de lecture (pas Write, pas Read qui est privé)
async function probe() {
  console.log("🔎 RPC disponibles :", Object.keys(CLMService.service));
  for (const method of ["ReadHeader", "readAquisition"]) {
    try {
      console.log(`🔎 ${method} :`, JSON.stringify(await call(method), null, 1));
    } catch (e) {
      console.error(`❌ ${method} :`, e);
    }
  }
}

function query_rpc_server() {
  client.ReadData({}, (err: any, response: any) => {
    if (err) {
      console.error("❌ gRPC ReadData error:", err);
    } else {
      if (DEBUG_DUMP) dumpChanges(response.values ?? []);
      sendChanges(parsePartsFromResponse(response));
    }
    setTimeout(query_rpc_server, POLL_INTERVAL_MS);
  });
}

async function main() {
  if (PROBE) await probe();
  query_rpc_server();
}

main();