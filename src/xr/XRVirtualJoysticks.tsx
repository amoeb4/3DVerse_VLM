import { useMemo } from "react";
import type { VirtualJoystickOptions } from "@3dverse/livelink-react-ui";
import { WebXRVirtualJoysticks } from "@3dverse/livelink-webxr";

import { useWebXRStore } from "./stores";

/**
 * Virtual joysticks driving the XR camera rig, on a touch screen: one under each thumb, wherever
 * it lands on its half of the screen. From 3dverse-mobile-viewer.
 *
 * Rendered as a child of `<WebXR>` rather than from the HUD: the locomotion hooks behind
 * `WebXRVirtualJoysticks` read `xrLivelink` from `WebXRContext`, so moving this outside the
 * provider leaves the sticks visible but inert. Before the app's own layout there, which then
 * stands over them and keeps its taps.
 */
export const XRVirtualJoysticks = () => {
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);

  const leftJoystickOptions: VirtualJoystickOptions = useMemo(
    () => ({ color: "white", mode: "dynamic", maxNumberOfNipples: 1 }),
    [],
  );
  const rightJoystickOptions: VirtualJoystickOptions = useMemo(
    () => ({ color: "white", mode: "dynamic", maxNumberOfNipples: 1 }),
    [],
  );

  if (!webXRUtils) {
    return null;
  }

  return (
    <WebXRVirtualJoysticks
      sizeInRem="6.25rem"
      leftRect={{ bottom: 0, top: 0, left: 0, width: "50%", height: "100%" }}
      rightRect={{ bottom: 0, top: 0, right: 0, width: "50%", height: "100%" }}
      leftJoystickOptions={leftJoystickOptions}
      rightJoystickOptions={rightJoystickOptions}
    />
  );
};
