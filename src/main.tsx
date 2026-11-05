import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer as NodeBuffer } from "buffer";
import App from "./App";

// Import CSS
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@3dverse/ui-lib/styles/index.css";
import "@3dverse/design-tokens/css/design-tokens.css";
import "@3dverse/design-tokens/css/axis-colors.css";
import "./styles/index.css";

if (!(window as any).Buffer) {
  (window as any).Buffer = NodeBuffer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
