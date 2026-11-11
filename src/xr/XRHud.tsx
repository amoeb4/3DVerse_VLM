import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useMediaQuery } from "../hooks/useMediaQuery";
import { useViewMode } from "../modes/useViewMode";
import { AnchorControls } from "./AnchorControls";
import { ARStartingOverlay } from "./ARStartingOverlay";
import { useMiniToastStore, useWebXRStore, useXRSettingsStore } from "./stores";
import { useIdleControlsVisibility } from "./useIdleControlsVisibility";
import { XRToolbar } from "./XRToolbar";

/**
 * What an XR session adds over the app's own layout, on a screen that shows the DOM (a phone, a
 * tablet), as in 3dverse-mobile-viewer: its toolbar (scale, opacity) at the top centre; at the
 * bottom centre the place button (AR) and the way out; the overlay while AR starts. They fade
 * after a spell without a touch, on small screens. A headset shows none of it: it has its own
 * menu, drawn in the session (`XRHeadsetUI`).
 *
 * The line confirming what was just done (`MiniToast`), which is also where a session that could
 * not start says so, is the footer's (`ViewerFooter`), in and out of XR.
 *
 * Mounted once, beside the `<WebXR>`/flat swap rather than in it, so it survives the transition.
 */
export function XRHud() {
  const xrMode = useWebXRStore((state) => state.xrMode);
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);
  const setXrMode = useWebXRStore((state) => state.setXrMode);
  const showMiniToast = useMiniToastStore((state) => state.showMiniToast);
  const areControlsVisible = useXRSettingsStore(
    (state) => state.areControlsVisible,
  );

  // On a screen wide enough, the fade is not buying any space.
  const isMediumScreen = useMediaQuery("(min-width: 768px)");
  useIdleControlsVisibility(!xrMode || isMediumScreen);

  // The session's controls stand over what the mode has at the bottom centre: the camera's toolbar
  // (`TertiaryToolbar`), or in Part its bottom stack, the toolbar over the timeline, taller on a
  // phone. Where they stood when the confirming line was under them.
  const { mode } = useViewMode();
  const isPartMode = mode === "part";

  return (
    <>
      <XRToolbar
        // Under the header and the job strip, between the columns.
        className="fixed z-50 left-1/2 -translate-x-1/2 top-32 lg:top-28"
      />
      <ARStartingOverlay />

      {webXRUtils && (
        <div
          className={cn(
            "fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3",
            isPartMode
              ? "bottom-[calc(var(--spacing-navbar)+11.25rem)]"
              : "bottom-[calc(var(--spacing-navbar)+3.75rem)]",
            "pointer-events-auto transition-opacity ease-in-out",
            areControlsVisible ? "duration-150" : "duration-1000",
          )}
          style={{
            opacity: areControlsVisible ? undefined : 0,
            pointerEvents: areControlsVisible ? undefined : "none",
          }}
        >
          <AnchorControls />
          <Button
            onClick={() => {
              setXrMode(null);
              showMiniToast("Exited XR mode");
            }}
            variant="default"
            round
          >
            <Icon className="fas fa-xmark" />
            Leave {xrMode === "immersive-vr" ? "VR" : "AR"}
          </Button>
        </div>
      )}
    </>
  );
}
