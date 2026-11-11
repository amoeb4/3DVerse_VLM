import { useCallback, useEffect, useRef } from "react";

import type { PointOfView } from "../camera/labelCamera";
import type { PointOfInterest } from "../camera/usePointOfInterest";
import type { ViewMode } from "./modes";

/**
 * The name of the scene's point of interest the Diagnostic looks at the cell from.
 *
 * Give a `label` that title (or name its entity so) and save a camera on it, the editor's label
 * camera: the Diagnostic brings the camera there. Without one in the scene, the Diagnostic looks
 * at the cell from its default view, as the other modes do.
 */
export const DIAGNOSTIC_POINT_OF_INTEREST = "diagnostic";

/**
 * Where each mode looks at the cell from, and the camera brought there:
 * - the Diagnostic: the scene's `diagnostic` point of interest, where it has one;
 * - Part: the part itself, which `PartInCell` brings the camera to, not this;
 * - Monitor, Training, and the Diagnostic without its point of interest: the cell's default view.
 *
 * The camera goes there as the mode changes, and as the viewer opens straight into a mode with a
 * point of interest (an expert's invite link opens the Diagnostic). `goToModeView` sends it there
 * again: as the diagnostic's run ends.
 */
export function useModeCamera({
  mode,
  resetCamera,
  travelToPointOfView,
  isCameraStarted,
  isAtDefaultPosition,
  diagnosticPointOfInterest,
  setPartCloseUp,
}: {
  mode: ViewMode;
  /** The camera back to the scene's default point of view (`useResetCamera`). */
  resetCamera: () => Promise<void>;
  /** The camera to another point of view (`useResetCamera`). */
  travelToPointOfView: (
    pointOfView: PointOfView,
    options?: { transition?: boolean },
  ) => Promise<void>;
  /** The camera has been put on its default view, as the viewer opened (`useResetCamera`). */
  isCameraStarted: boolean;
  /** The camera is where the default view left it: the viewer has not taken it. */
  isAtDefaultPosition: boolean;
  /** `DIAGNOSTIC_POINT_OF_INTEREST` in this scene (`usePointOfInterest`). */
  diagnosticPointOfInterest: PointOfInterest;
  /** Part's close-up on the bead being laid (`usePartViewState`). */
  setPartCloseUp: (closeUp: boolean) => void;
}) {
  const {
    isPending: isPointOfInterestPending,
    pointOfView: diagnosticPointOfView,
  } = diagnosticPointOfInterest;
  // The mode's own point of view; `null`, the cell's default view.
  const modePointOfView = mode === "assistance" ? diagnosticPointOfView : null;

  const goToModeView = useCallback(() => {
    void (modePointOfView
      ? travelToPointOfView(modePointOfView)
      : resetCamera());
  }, [modePointOfView, travelToPointOfView, resetCamera]);

  // Read as the mode changes, not followed: a label edited in the scene does not move the camera
  // of someone already in the Diagnostic.
  const goToModeViewRef = useRef(goToModeView);
  // Declared first, so it has run by the time the mode's change is handled below.
  useEffect(() => {
    goToModeViewRef.current = goToModeView;
  }, [goToModeView]);

  // As the mode changes.
  const previousMode = useRef(mode);
  useEffect(() => {
    const previous = previousMode.current;
    previousMode.current = mode;
    if (previous === mode) {
      return;
    }
    if (previous === "part") {
      // Back in Part, the whole part first.
      setPartCloseUp(false);
    }
    if (mode !== "part") {
      goToModeViewRef.current();
    }
  }, [mode, setPartCloseUp]);

  // As the viewer opens. The camera starts on the default view (`useResetCamera`), and the scene's
  // labels are known a moment later: once both are, the camera is put on the mode's point of
  // interest, at once, as the start. Once only, and not if the viewer has taken the camera
  // meanwhile.
  const hasOpened = useRef(false);
  useEffect(() => {
    if (hasOpened.current || !isCameraStarted || isPointOfInterestPending) {
      return;
    }
    hasOpened.current = true;
    if (modePointOfView && isAtDefaultPosition) {
      void travelToPointOfView(modePointOfView, { transition: false });
    }
  }, [
    isCameraStarted,
    isPointOfInterestPending,
    modePointOfView,
    isAtDefaultPosition,
    travelToPointOfView,
  ]);

  return { goToModeView };
}
