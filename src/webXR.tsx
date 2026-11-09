import { Button, cn, Icon } from "@3dverse/ui-lib";
import { useState, useEffect } from "react";
import { WebXR } from "@3dverse/livelink-webxr";

// Explicitly type the WebXR mode strings
type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";

/**
 * Enters a WebXR session, or says why it cannot: disabled, its reason as the tooltip, where the
 * device or the page (https) does not support it. `icon` (a Font Awesome class) and `variant` for
 * a toolbar's entry; a pill by default.
 */
export function XRButton({
  mode,
  setXRMode,
  text = "Enter",
  icon,
  variant = "overlay-outline",
  className,
}: {
  mode: XRSessionMode;
  text?: string;
  setXRMode: (mode: XRSessionMode) => void;
  icon?: string;
  variant?: "overlay-outline" | "ghost";
  className?: string;
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
    <Button
      variant={variant}
      size="sm"
      className={cn(
        variant === "overlay-outline" &&
          "rounded-full before:opacity-100 before:backdrop-blur-xl",
        !isSessionSupported && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={() => setXRMode(mode)}
      disabled={!isSessionSupported}
      title={message || `${text || "Enter"} ${xrModeTitle}`}
    >
      {icon && <Icon className={cn("fas text-2xs", icon)} />}
      {text ? `${text} ${xrModeTitle}` : xrModeTitle}
    </Button>
  );
}
