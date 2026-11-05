// run-proxy.ts
import { OpcUa6AxisBridge } from "./opcua-proxy";

async function main() {
  const joints = [
    { namespace: 1, nodeId: "A1", axisName: "part_1" },
    { namespace: 1, nodeId: "A2", axisName: "part_2" },
    { namespace: 1, nodeId: "A3", axisName: "part_3" },
    { namespace: 1, nodeId: "A4", axisName: "part_4" },
    { namespace: 1, nodeId: "A5", axisName: "part_5" },
    { namespace: 1, nodeId: "A6", axisName: "part_6" },
    { namespace: 1, nodeId: "A7", axisName: "part_7" },
    { namespace: 1, nodeId: "A8", axisName: "part_8" },
  ];

  const bridge = new OpcUa6AxisBridge(joints, "ws://localhost:8767");

  await bridge.connectOpcUa("opc.tcp://localhost:4840/UA/Robot6Axes");
  bridge.connectWebSocket();
  bridge.startPolling();
}

main().catch(console.error);
