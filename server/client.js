import WebSocket from "ws";
import readline from "readline";

const socket = new WebSocket("ws://localhost:8081");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
socket.on("open", () => {
  console.log(
    "Connexion au serveur établie\nUtilisez la commande !help pour obtenir la liste des commandes\n",
  );
  socket.send("Client connected");
  promptUser();
});
socket.on("message", (data) => {
  console.log("Message from server:", data.toString());
});
socket.on("close", () => {
  console.log("Client disconnected");
  rl.close();
});

function promptUser() {
  rl.question("> ", (input) => {
    if (input === "exit") {
      socket.close();
      return;
    }
    socket.send(input);
    promptUser();
  });
}
