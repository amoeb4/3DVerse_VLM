// opcua6AxisBridge.ts
import {
  OPCUAClient as OPCUANodeClient,
  ClientSession,
  AttributeIds,
  UserIdentityInfoUserName,
  UserTokenType,
} from "node-opcua";
import WebSocket from "ws";

type OpcUaJoint = {
  namespace: number;
  nodeId: string;
  axisName: string;
};

export class OpcUa6AxisBridge {
  private client: OPCUANodeClient;
  private session: ClientSession | null = null;
  private joints: OpcUaJoint[];
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private pollingInterval: number;
  private pollingTimer: NodeJS.Timer | null = null;
  private reconnectDelay = 2000;

  constructor(joints: OpcUaJoint[], wsUrl: string, pollingInterval = 16) {
    this.client = OPCUANodeClient.create({ endpointMustExist: false });
    this.joints = joints;
    this.wsUrl = wsUrl;
    this.pollingInterval = pollingInterval;
  }

  async connectOpcUa(endpoint: string, username?: string, password?: string) {
    try {
      await this.client.connect(endpoint);

      let userIdentity: UserIdentityInfoUserName | undefined;
      if (username && password) {
        userIdentity = {
          type: UserTokenType.UserName,
          userName: username,
          password: password,
        };
      }

      this.session = await this.client.createSession(userIdentity);
      console.log("✅ OPC-UA session established");
    } catch (err) {
      console.error("⚠️ Failed to connect OPC-UA:", err);
      setTimeout(
        () => this.connectOpcUa(endpoint, username, password),
        this.reconnectDelay,
      );
    }
  }

  connectWebSocket() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on("open", () => {
      console.log("✅ WebSocket bridge connected");
    });

    this.ws.on("close", () => {
      console.log("❌ WebSocket bridge closed, retrying...");
      setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
    });

    this.ws.on("error", (err) => {
      console.error("⚠️ WebSocket bridge error:", err);
    });
  }

  private sendUpdate(update: {
    name: string;
    location: [number, number, number, number?];
  }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(update));
    }
  }

  startPolling() {
    if (!this.session) throw new Error("No OPC-UA session established");
    if (!this.ws) this.connectWebSocket();

    this.pollingTimer = setInterval(async () => {
      const updates: {
        name: string;
        location: [number, number, number, number?];
      }[] = [];

      for (const joint of this.joints) {
        try {
          const data = await this.session!.read({
            nodeId: `ns=${joint.namespace};s=${joint.nodeId}`,
            attributeId: AttributeIds.Value,
          });

          const value = data.value.value;
          updates.push({ name: joint.axisName, location: [value, 0, 0, 0] });
        } catch (err) {
          console.error(`⚠️ Failed to read ${joint.axisName}:`, err);
        }
      }

      updates.forEach((update) => this.sendUpdate(update));
    }, this.pollingInterval);
  }

  async disconnect() {
    await this.session?.close();
    await this.client.disconnect();
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close();
  }
}
