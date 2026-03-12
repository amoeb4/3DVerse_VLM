import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer as NodeBuffer } from "buffer";
import "./index.css";
import App from "./App";
import { getCallSites } from "util";
import { UnderlineIcon } from "@heroicons/react/20/solid";

if (!(window as any).Buffer) {
  (window as any).Buffer = NodeBuffer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>

);