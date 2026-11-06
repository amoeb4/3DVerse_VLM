import { WebXR } from "@3dverse/livelink-webxr";
import { useState, useEffect } from "react";

// Explicitly type the WebXR mode strings
type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";

export function XRButton({
  mode,
  setXRMode,
  text = "Enter",
}: {
  mode: XRSessionMode;
  text?: string;
  setXRMode: (mode: XRSessionMode) => void;
}) {
  const [isSessionSupported, setIsSessionSupported] = useState(false);
  const [message, setMessage] = useState("");
  const xrModeTitle = mode.endsWith("ar") ? "AR" : "VR";

  useEffect(() => {
    if (!window.isSecureContext) {
      setMessage("WebXR requires a secure context (https).");
      return;
    }

        const checkSupport = navigator.xr?.isSessionSupported 
            ? navigator.xr.isSessionSupported(mode)
            : Promise.resolve(false);

    checkSupport.then((supported) => {
      if (!supported) {
        setMessage(`WebXR '${mode}' is not supported on this device.`);
      } else {
        setIsSessionSupported(true);
      }
    });
  }, [mode]);

  return (
    <button
      className={
        "button button-primary" + (!isSessionSupported ? " opacity-50" : "")
      }
      onClick={() => setXRMode(mode)}
      disabled={!isSessionSupported}
      style={isSessionSupported ? {} : { cursor: "not-allowed" }}
      title={message}
    >
      {text} {xrModeTitle}
    </button>
  );
}
