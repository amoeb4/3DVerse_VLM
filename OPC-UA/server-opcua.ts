// server-opcua.ts
import { OPCUAServer, Variant, DataType, StatusCodes } from "node-opcua";

async function startServer() {
  const server = new OPCUAServer({
    port: 4840,
    resourcePath: "/UA/Robot6Axes",
    buildInfo: {
      productName: "Robot6AxesSimulator",
      buildNumber: "1",
      buildDate: new Date(),
    },
  });

  await server.initialize();
  const addressSpace = server.engine.addressSpace!;
  const namespace = addressSpace.getOwnNamespace();

  const robotFolder = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "Robot6Axes",
  });
  const jointNames = [
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "A9",
    "A10",
  ];
  const variables: Record<string, { value: number }> = {};

  jointNames.forEach((joint) => {
    variables[joint] = { value: 0 };

    namespace.addVariable({
      componentOf: robotFolder,
      browseName: joint,
      nodeId: `ns=1;s=${joint}`,
      dataType: "Double",
      accessLevel: "CurrentRead | CurrentWrite",
      userAccessLevel: "CurrentRead | CurrentWrite",
      value: {
        get: () => {
          return new Variant({
            dataType: DataType.Double,
            value: variables[joint].value,
          });
        },
        set: (variant) => {
          console.log(`Joint ${joint} set to`, variant.value);
          variables[joint].value = variant.value;
          return StatusCodes.Good;
        },
      },
    });
  });

  await server.start();
  console.log(
    "✅ OPC-UA Server is running at opc.tcp://localhost:4840/UA/Robot6Axes",
  );
  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping OPC-UA Server...");
    await server.shutdown(1000);
    console.log("✅ Server stopped.");
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    console.log("\n🛑 Server received SIGTERM");
    await server.shutdown(1000);
    console.log("✅ Server stopped.");
    process.exit(0);
  });
}

startServer().catch(console.error);
