import { WebSocketServer } from "ws";

import { messageLibrary } from "./library.js";

const wss = new WebSocketServer({ port: 8081 });

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.on("message", (message) => {
    parseMessage(message);
  });
});

console.log("Listening on port : 8081, waiting for a response...");

function parseMessage(message) {
  const msg = message.toString();
  if (msg in messageLibrary) {
    const entry = messageLibrary[msg];
    if (typeof entry === "function") {
      const apply = entry();
      console.log(apply);
    } else {
      console.log(`${messageLibrary[msg]}`);
    }
  } else console.log("Message received:", msg);
}
