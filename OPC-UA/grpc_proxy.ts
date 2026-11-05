import grpc from "@grpc/grpc-js";
import protoloader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = __dirname + "/cnc.proto";

var packageDefinition = protoloader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

var CNCService: any = protoDescriptor.CNCService;
var client = new CNCService(
  "192.168.0.1:50051",
  grpc.credentials.createInsecure(),
);

function onResponse(arg1, response, arg2, arg3) {
  console.log("GRPC request response : ", arg1, response, arg2, arg3);
  setTimeout(query_rpc_server, 1000);
}

function query_rpc_server() {
  var request = client.ReadVariable(
    {
      node_id: "ns=2;s=Axis1.Position",
      node_id2: "ns=2;s=Axis1.Position",
      node_id3: "ns=2;s=Axis1.Position",
      node_id4: "ns=2;s=Axis1.Position",
      node_id5: "ns=2;s=Axis1.Position",
      node_id6: "ns=2;s=Axis1.Position",
      node_id7: "ns=2;s=Axis1.Position",
      node_id8: "ns=2;s=Axis1.Position",
      node_id9: "ns=2;s=Axis1.Position",
      node_id10: "ns=2;s=Axis1.Position",
    },
    onResponse,
  );
}

query_rpc_server();
