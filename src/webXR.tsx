import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useWebXRStore } from "./xr/stores";
import { useEnterXR } from "./xr/useXRSupport";
import type { XRImmersiveMode } from "./xr/xrSupport";

/**
 * Enters a WebXR session, or says why it cannot: disabled, its reason as the tooltip, where the
 * device or the page (https) does not support it. `icon` (a Font Awesome class) and `variant` for
 * a toolbar's entry; a pill by default.
 *
 * Support is detected once for the whole viewer (`useXRSupportDetection`), and entering goes the
 * same way from every button (`useEnterXR`): on iOS, through the Variant Launch Clip App.
 */
export function XRButton({
  mode,
  text = "Enter",
  icon,
  variant = "overlay-outline",
  className,
}: {
  mode: XRImmersiveMode;
  text?: string;
  icon?: string;
  variant?: "overlay-outline" | "ghost";
  className?: string;
}) {
  const support = useWebXRStore((state) => state.xrSupport[mode]);
  const isPending = useWebXRStore((state) => state.isXRSupportPending);
  const enterXR = useEnterXR();
  const xrModeTitle = mode.endsWith("ar") ? "AR" : "VR";

  let message = "";
  if (!window.isSecureContext) {
    message = "WebXR requires a secure context (https).";
  } else if (isPending) {
    message = "Checking for XR…";
  } else if (!support.isSupported) {
    message = `WebXR '${mode}' is not supported on this device.`;
  } else if (support.needsSafari) {
    message = "Open this page in Safari to start AR.";
  }

  return (
    <Button
      variant={variant}
      size="sm"
      className={cn(
        variant === "overlay-outline" &&
          "rounded-full before:opacity-100 before:backdrop-blur-xl",
        !support.isSupported && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={() => enterXR(mode)}
      disabled={!support.isSupported}
      title={message || `${text || "Enter"} ${xrModeTitle}`}
    >
      {icon && <Icon className={cn("fas text-2xs", icon)} />}
      {text ? `${text} ${xrModeTitle}` : xrModeTitle}
    </Button>
  );
}
