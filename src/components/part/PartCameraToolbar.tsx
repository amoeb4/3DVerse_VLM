import { Tabs, TabsList, TabsTrigger } from "@3dverse/ui-lib";

import type { PartViewState } from "../../modes/partViewState";
import { SHORTCUTS } from "../../shortcuts/shortcuts";
import { XRButton } from "../../webXR";
import { useWebXRStore } from "../../xr/stores";
import { TertiaryToolbar, ToolbarDivider } from "../common/TertiaryToolbar";

/**
 * Part's toolbar, over its timeline (`PartChrome`): the camera on the whole part or close up on
 * the bead being laid, and the part in AR.
 */
export function PartCameraToolbar({
  partView,
  isLargeScreen,
  isXR,
}: {
  partView: Pick<PartViewState, "closeUp" | "setCloseUp" | "refocus">;
  isLargeScreen: boolean;
  /** During an XR session, which has its own controls (`XRHud`). */
  isXR: boolean;
}) {
  // Detected once for the viewer (`XRSupport`); false until it has answered.
  const isARSupported = useWebXRStore(
    (state) => state.xrSupport["immersive-ar"].isSupported,
  );

  return (
    <TertiaryToolbar aria-label="Camera and AR">
      <Tabs
        value={partView.closeUp ? "bead" : "part"}
        onValueChange={(value) => {
          if (value === "bead") partView.setCloseUp(true);
        }}
      >
        <TabsList variant="segment" size="sm" aria-label="View">
          <TabsTrigger
            value="part"
            className="px-3 text-2xs"
            title={`The whole part (${SHORTCUTS.reset.toUpperCase()})`}
            // Again on the part, even when already on it: the camera back to it.
            onClick={partView.refocus}
          >
            Whole part
          </TabsTrigger>
          <TabsTrigger
            value="bead"
            className="px-3 text-2xs"
            title="Close up on the bead being laid, following the torch"
          >
            Weld bead
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {/* Below `lg`, AR is entered from the XR button (`XRSheet`). Nothing where this device
          cannot enter AR, nor until that is known. */}
      {isLargeScreen && !isXR && isARSupported && (
        <>
          <ToolbarDivider />
          <XRButton
            mode="immersive-ar"
            text="Open in"
            variant="ghost"
            icon="fa-cube"
          />
        </>
      )}
    </TertiaryToolbar>
  );
}
