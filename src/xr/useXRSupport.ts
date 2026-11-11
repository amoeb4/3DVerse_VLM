import { useCallback, useContext, useEffect } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";

import { useWebXRStore } from "./stores";
import {
  detectXRSupport,
  enterXR as enterXRSession,
  type XRImmersiveMode,
} from "./xrSupport";
import { isARSessionURLParam, isVRSessionURLParam } from "./searchParams";

// From 3dverse-mobile-viewer's apps/common/hooks/useXRSupport.ts.

// Module scope on purpose: both are page-load-scoped, not component-scoped. Probing is
// idempotent but pointless to repeat, and the deep link must fire at most once — were it tied to
// a component instance, any remount of the host would re-enter XR right after the user exited it
// and leave them unable to get out.
let hasStartedDetection = false;
let hasAutoEnteredXR = false;

/**
 * Probe WebXR support once for every immersive mode and publish the result to the store.
 *
 * Mount this from a component that is always rendered — not from inside the XR menu — so the
 * answer is available before the user opens anything.
 */
export function useXRSupportDetection(): void {
  const setXRSupport = useWebXRStore((state) => state.setXRSupport);

  useEffect(() => {
    if (hasStartedDetection) {
      return;
    }
    hasStartedDetection = true;

    detectXRSupport(new AbortController().signal)
      .then((xrSupport) => {
        console.debug("WebXR support detected:", xrSupport);
        setXRSupport(xrSupport);
      })
      .catch((error) => {
        console.error("Failed to detect WebXR support", error);
        hasStartedDetection = false;
      });
  }, [setXRSupport]);
}

/**
 * Stable callback entering the given immersive mode, transparently relaunching through the
 * Variant Launch iOS Clip App when that device requires it.
 */
export function useEnterXR(): (mode: XRImmersiveMode) => void {
  const { instance } = useContext(LivelinkContext);
  const sessionId = instance?.session.session_id;
  return useCallback(
    (mode: XRImmersiveMode) => {
      const { xrSupport, setXrMode } = useWebXRStore.getState();
      enterXRSession({
        mode,
        isVlaunchRequired: xrSupport[mode].isVlaunchRequired,
        setXrMode,
        sessionId,
      });
    },
    [sessionId],
  );
}

/**
 * Enter the immersive mode requested through `?xr=<mode>` as soon as support is known.
 *
 * This is what closes the Variant Launch round trip on iOS: `enterXR` relaunches the app
 * inside the Clip App with that search param set, and the reloaded app has to pick the
 * session back up on its own.
 */
export function useAutoEnterXR(): void {
  const isXRSupportPending = useWebXRStore((state) => state.isXRSupportPending);
  const xrSupport = useWebXRStore((state) => state.xrSupport);
  const enterXR = useEnterXR();

  useEffect(() => {
    if (isXRSupportPending || hasAutoEnteredXR) {
      return;
    }

    let requestedMode: XRImmersiveMode | null = null;
    if (isARSessionURLParam) {
      requestedMode = "immersive-ar";
    } else if (isVRSessionURLParam) {
      requestedMode = "immersive-vr";
    }

    if (!requestedMode) {
      return;
    }

    // Only auto-enter once per page load, so that exiting XR does not immediately re-enter it.
    hasAutoEnteredXR = true;

    if (!xrSupport[requestedMode].isSupported) {
      console.warn(
        `${requestedMode} requested through the URL but not supported on this device.`,
      );
      return;
    }

    console.debug(`Auto-entering ${requestedMode} requested through the URL.`);
    enterXR(requestedMode);
  }, [isXRSupportPending, xrSupport, enterXR]);
}

/**
 * The viewer's XR support, mounted once inside `<Livelink>`: detection, and the `?xr=` deep link.
 * Renders nothing.
 */
export function XRSupport(): null {
  useXRSupportDetection();
  useAutoEnterXR();
  return null;
}
