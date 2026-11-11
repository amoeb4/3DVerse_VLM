//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { useWebXRStore } from "./stores";

//------------------------------------------------------------------------------
/**
 * Whether the AR place button can be used right now.
 *
 * `isPlacementAvailable` is a property of the device — a hit test source was created at all —
 * and is fixed for the session: the library settles it before `XRLivelink.initialize` resolves and
 * `WebXRUtils` is only published to the store once its own `init()` has, so reading it
 * synchronously is safe.
 *
 * `hasSurface` changes as the user moves the phone, so it is read once per XR frame from the
 * `anchor` phase — after the library's placement update, which is what makes it this frame's
 * answer. The `setState` is written as a bail-out: a boolean that has not changed must not
 * re-render the HUD ninety times a second.
 */
export function useARPlacement(): {
  isPlacementAvailable: boolean;
  hasSurface: boolean;
} {
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);
  const livelinkXR = webXRUtils?.livelinkXR;

  const [hasSurface, setHasSurface] = useState(false);

  // Reset on a new session rather than in the subscribing effect: nothing pushes a transition any
  // more, so a `true` left over from the previous session would survive until the next frame that
  // happened to disagree.
  const [prevLivelinkXR, setPrevLivelinkXR] = useState(livelinkXR);
  if (livelinkXR !== prevLivelinkXR) {
    setPrevLivelinkXR(livelinkXR);
    setHasSurface(false);
  }

  useEffect(() => {
    if (!livelinkXR) {
      return;
    }

    // Returning the current value makes React bail out without rendering, which is what keeps
    // a per-frame callback from re-rendering the HUD at display rate.
    return livelinkXR.addFrameCallback({
      phase: "anchor",
      callback: () => {
        const next = livelinkXR.placement.has_surface;
        setHasSurface((prev) => (prev === next ? prev : next));
      },
    });
  }, [livelinkXR]);

  return {
    isPlacementAvailable: livelinkXR?.placement.is_available ?? false,
    hasSurface,
  };
}
