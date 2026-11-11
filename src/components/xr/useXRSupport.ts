import { useEffect, useState } from "react";

export type XRImmersiveMode = "immersive-ar" | "immersive-vr";

export type XRSupport = Record<XRImmersiveMode, boolean>;

const NONE: XRSupport = { "immersive-ar": false, "immersive-vr": false };

async function detect(mode: XRImmersiveMode): Promise<boolean> {
  try {
    return (await navigator.xr?.isSessionSupported(mode)) ?? false;
  } catch {
    return false;
  }
}

/**
 * Which immersive modes this device and browser can enter, asked once: `isPending` until they have
 * answered. None over plain http, where WebXR is not available at all.
 *
 * Asked where the XR button stands, not in its sheet, so the answer is there when the sheet opens.
 */
export function useXRSupport(): { isPending: boolean; support: XRSupport } {
  const [support, setSupport] = useState<XRSupport | null>(null);

  useEffect(() => {
    let active = true;
    if (!window.isSecureContext) {
      console.error("WebXR requires a secure context (https).");
      setSupport(NONE);
      return;
    }
    Promise.all([detect("immersive-ar"), detect("immersive-vr")]).then(
      ([ar, vr]) => {
        if (active) {
          setSupport({ "immersive-ar": ar, "immersive-vr": vr });
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return { isPending: support === null, support: support ?? NONE };
}
