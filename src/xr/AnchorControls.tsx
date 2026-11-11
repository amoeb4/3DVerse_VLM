import { useCallback } from "react";
import { Button } from "@3dverse/ui-lib";

import { useMiniToastStore, useWebXRStore } from "./stores";
import { useARPlacement } from "./useARPlacement";

/** The AR place button: the model lands where the reticle is. From 3dverse-mobile-viewer. */
export const AnchorControls = () => {
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);
  const showMiniToast = useMiniToastStore((state) => state.showMiniToast);
  const { isPlacementAvailable, hasSurface } = useARPlacement();

  // Acknowledge the tap over the camera feed. The button is disabled without a surface, so the
  // `false` branch is only the race where the hit test drops between the render and the tap.
  const handlePlaceModel = useCallback(() => {
    if (!webXRUtils) {
      return;
    }
    const placed = webXRUtils.livelinkXR.placement.place();
    showMiniToast(placed ? "Model placed" : "No surface detected");
  }, [webXRUtils, showMiniToast]);

  // Hidden rather than dimmed where no hit test source could be created: a control that can never
  // work explains nothing.
  if (!webXRUtils || !isPlacementAvailable) {
    return null;
  }

  return (
    // Dimmed and inert until the hit test has a surface. The reticle is what says where the model
    // will land.
    <Button
      onClick={handlePlaceModel}
      disabled={!hasSurface}
      aria-label={
        hasSurface
          ? "Place the model on a surface"
          : "Point at a surface to place the model"
      }
      variant="ghost"
      round
      className="border border-secondary bg-ground/65 backdrop-blur-lg"
    >
      Place model
    </Button>
  );
};
