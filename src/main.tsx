import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Buffer as NodeBuffer } from "buffer";
import App from "./App";
import { useXRSettingsStore } from "./xr/stores";
import { isRecognizedXrHeadset } from "./xr/utils";

// Import CSS
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@3dverse/ui-lib/styles/index.css";
import "@3dverse/design-tokens/css/design-tokens.css";
import "@3dverse/design-tokens/css/axis-colors.css";
import "./styles/index.css";

// The XR render settings that suit this device: overscan and latency compensation in a headset,
// neither on a phone (`useXRSettingsStore`).
void isRecognizedXrHeadset().then(
  useXRSettingsStore.getState().applyXRDeviceDefaults,
);

if (!(window as any).Buffer) {
  (window as any).Buffer = NodeBuffer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
