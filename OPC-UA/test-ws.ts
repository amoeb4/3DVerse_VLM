import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8767"); // URL du websocket

ws.on("open", () => {
  console.log("Connected to bridge");
});

ws.on("message", (msg) => {
  console.log("Received:", msg.toString());
});
