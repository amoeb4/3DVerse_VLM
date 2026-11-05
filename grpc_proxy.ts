import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname } from "path";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = __dirname + "/cnc.proto";

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

const client = new CLMService(
  "192.168.214.252:50051",
  grpc.credentials.createInsecure()
);
if (!client) console.error("❌ Impossible de créer le client gRPC");

// Connexion WebSocket
const ws = new WebSocket("ws://localhost:8767");
ws.on("open", () => {
  console.log("🔗 Connected to WebSocket server");
});

const orientationMap: Record<number, (val: number) => [number, number, number]> = {
  1: (val) => [90, 0, -val],
  2: (val) => [-90, -val+270, 90],
  3: (val) => [0, 0, val-180],
  4: (val) => [-val, 0, 90],
  5: (val) => [-180, 0, -val+180],
  6: (val) => [-val+180, 0, 180],
};

function parsePartsFromResponse(response: any): { name: string; location: number[] }[] {
  if (!response?.values || !Array.isArray(response.values)) return [];

  const parts: { name: string; location: number[] }[] = [];
  for (let i = 1; i <= 7; i++) {
    const floatVal = response.values[i]?.float_value ?? null;
    if (i == 7)
      break;
    if (floatVal !== null && !isNaN(floatVal)) {
      const location = orientationMap[i](floatVal);
      parts.push({
        name: `part_${i}`,
        location,
      });
    }
  }
  return parts;
}

function query_rpc_server() {
  client.ReadData({}, (err: any, response: any) => {
    if (err) {
      console.error("❌ gRPC ReadData error:", err);
    } else {
      console.log("✅ ReadData response:", response);
      const parts = parsePartsFromResponse(response);
      if (ws.readyState === WebSocket.OPEN) {
        parts.forEach((msg) => {
          if (!msg.location.every((v) => v === 0)) {
            ws.send(JSON.stringify(msg));
            console.log("📨 Sent:", msg);
          } else {
            console.log(`⏩ ${msg.name} = [0,0,0], rien envoyé`);
          }
        });
      }
    }
    setTimeout(query_rpc_server, 33);
  });
}
query_rpc_server();