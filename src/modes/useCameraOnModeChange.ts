import { useEffect, useRef } from "react";

import type { ViewMode } from "./modes";

/**
 * Switching modes: the camera back to the cell's default view. Not into Part, which brings it to
 * the part itself (`PartInCell`).
 */
export function useCameraOnModeChange({
  mode,
  resetCamera,
  setPartCloseUp,
}: {
  mode: ViewMode;
  /** The camera back to the scene's default point of view (`useResetCamera`). */
  resetCamera: () => Promise<void>;
  /** Part's close-up on the bead being laid (`usePartViewState`). */
  setPartCloseUp: (closeUp: boolean) => void;
}) {
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
      void resetCamera();
    }
  }, [mode, resetCamera, setPartCloseUp]);
}
