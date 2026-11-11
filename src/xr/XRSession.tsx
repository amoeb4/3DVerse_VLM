import { useCallback, type ReactNode } from "react";
import { WebXR } from "@3dverse/livelink-webxr";
import type { Transform } from "@3dverse/livelink";

import { CameraControllerWebXR } from "./CameraControllerWebXR";
import { XRVirtualJoysticks } from "./XRVirtualJoysticks";
import { isVlaunchClipApp } from "./searchParams";
import { useMiniToastStore, useWebXRStore, useXRSettingsStore } from "./stores";
import { getEnterXRErrorMessage } from "./xrSupport";

/**
 * The running XR session, as 3dverse-mobile-viewer runs it: `<WebXR>` in place of the flat view,
 * with what reads `WebXRContext` (the rig's camera controller, the joysticks), then `children`,
 * the app's own layout, over the joysticks so it keeps its taps.
 *
 * Mounted on the strength of the store's `xrMode`, set optimistically by whoever asks for XR
 * (`useEnterXR`); it puts the mode back once the session fails to start or is ended.
 */
export function XRSession({
  mode,
  originTransform,
  children,
}: {
  mode: XRSessionMode;
  /** Where the session starts, from the scene's `xr_start` entity (`xrStartMarker.ts`). */
  originTransform?: Partial<Transform>;
  children: ReactNode;
}) {
  const setXRMode = useWebXRStore((state) => state.setXrMode);
  const hasOverscan = useXRSettingsStore((state) => state.hasOverscan);
  const hasLatencyCompensation = useXRSettingsStore(
    (state) => state.hasLatencyCompensation,
  );

  // Both callbacks below exist to put the mode back: without them a session that never started,
  // or one the system ended, leaves the app rendering a `<WebXR>` with nothing behind it.
  const handleError = useCallback(
    (error: unknown) => {
      console.error("Could not start the XR session:", error);
      setXRMode(null);
      useMiniToastStore.getState().showMiniToast(getEnterXRErrorMessage(error));
    },
    [setXRMode],
  );
  // Only ends we did not ask for are reported here — the library suppresses the ones it causes
  // itself — so this can be wired unconditionally.
  const handleSessionEnd = useCallback(() => {
    console.debug("XR session ended externally, leaving XR mode.");
    setXRMode(null);
  }, [setXRMode]);

  return (
    <WebXR
      mode={mode}
      optionalFeatures={[
        "hit-test",
        "anchors",
        "plane-detection",
        "local",
        "local-floor",
      ]}
      // The whole page: what the app portals to `<body>` (sheets, menus, dialogs) is then
      // composited into a handheld session with the rest. A headset grants no DOM overlay at all,
      // hence its own menu (`XRHeadsetUI`).
      domOverlayRoot={document.body}
      forceSingleView={isVlaunchClipApp}
      overscan={hasOverscan}
      latencyCompensation={hasLatencyCompensation}
      // A copy: the rig writes `orientation` into the object it is given.
      originTransform={originTransform && { ...originTransform }}
      onError={handleError}
      onSessionEnd={handleSessionEnd}
    >
      <CameraControllerWebXR />
      <XRVirtualJoysticks />
      {children}
    </WebXR>
  );
}
