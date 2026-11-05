// opcua-client.ts
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  TimestampsToReturn,
  ReadValueIdOptions,
} from "node-opcua";
import { useState } from "react";
import WebSocket from "ws";

const jointToPartMap: Record<string, string> = {
  A1: "part_1",
  A2: "part_2",
  A3: "part_3",
  A4: "part_4",
  A5: "part_5",
  A6: "part_6",
  A7: "part_7",
  A8: "part_8",
};

const positions: Record<string, [number, number, number]> = {
  part_1: [0.0, 0.0, 0.0],
  part_2: [0.0, 0.0, 0.0],
  part_3: [0.0, 0.0, 0.0],
  part_4: [0.0, 0.0, 0.0],
  part_5: [0.0, 0.0, 0.0],
  part_6: [0.0, 0.0, 0.0],
  part_7: [0.0, 0.0, 0.0],
  part_8: [0.0, 0.0, 0.0],
};

function convertAngleToLocation(
  angleDeg: number,
  joint: string,
): [number, number, number] {
  // Exemple de conversion angle -> position 3D
  // Vous pouvez adapter cette logique selon vos besoins

  switch (joint) {
    case "A1": // Rotation base (axe Z)
      return [0, 0, 1];
    case "A2": // Épaule (axe Z)
      return [Math.sin((angleDeg * Math.PI) / 180), 0, 0];
    case "A3": // Coude (axe Z)
      return [0, 0, Math.cos((angleDeg * Math.PI) / 180)];
    case "A4": // Poignet 1 (axe X)
      return [0, 0, Math.cos((angleDeg * Math.PI) / 180)];
    case "A5": // Poignet 2 (axe Z)
      return [0, 0, Math.cos((angleDeg * Math.PI) / 180)];
    case "A6": // Poignet 3 (axe X)
      return [Math.sin((angleDeg * Math.PI) / 180), 0, 0];
    case "A7": // berceau vireur (axe X)
      return [0, Math.sin((angleDeg * Math.PI) / 180), 0];
    case "A8": // plateau vireur (axe Y)
      return [0, Math.sin((angleDeg * Math.PI) / 180), 0];
    default:
      return [0, 0, 0];
  }
}

async function main() {
  try {
    const ws = new WebSocket("ws://localhost:8767");
    ws.on("open", () => console.log("✅ Connected to WebSocket bridge"));

    const client = OPCUAClient.create({
      endpointMustExist: false,
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
    });

    const endpointUrl = "opc.tcp://localhost:4840/UA/Robot6Axes";
    await client.connect(endpointUrl);
    console.log("✅ Connected to OPC-UA server");

    const session = await client.createSession();
    console.log("✅ Session created");

    const subscription = await session.createSubscription2({
      requestedPublishingInterval: 80,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 10,
      publishingEnabled: true,
      priority: 10,
    });

    for (const joint of Object.keys(jointToPartMap)) {
      const nodeId = `ns=1;s=${joint}`;
      const itemToMonitor: ReadValueIdOptions = {
        nodeId,
        attributeId: AttributeIds.Value,
      };

      const monitoredItem = await subscription.monitor(
        itemToMonitor,
        { samplingInterval: 33, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both,
      );

      monitoredItem.on("changed", (value) => {
        const angleDeg = value.value.value;
        const partName = jointToPartMap[joint];

        console.log(`🔄 ${joint} -> ${partName} = ${angleDeg.toFixed(2)}°`);
        const location = convertAngleToLocation(angleDeg, joint);
        positions[partName] = location;
        if (ws.readyState === WebSocket.OPEN) {
          const message = JSON.stringify({
            name: partName,
            location: location,
          });
          ws.send(message);
          console.log(`Commande envoyée : ${message}`);
        }
        ("");
      });
    }

    process.on("SIGINT", async () => {
      console.log("\n🛑 Closing session...");
      await subscription.terminate();
      await session.close();
      await client.disconnect();
      console.log("✅ Disconnected cleanly");
      process.exit(0);
    });
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
