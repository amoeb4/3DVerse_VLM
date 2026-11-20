import { Button, cn, Tabs, TabsList, TabsTrigger } from "@3dverse/ui-lib";

import type { PartViewState } from "../../modes/partViewState";
import { SHORTCUTS } from "../../shortcuts/shortcuts";
import { XRButton } from "../../webXR";
import { useWebXRStore } from "../../xr/stores";
import { TertiaryToolbar, ToolbarDivider } from "../common";

/**
 * Part's toolbar, over its timeline (`PartChrome`): the camera on the whole part or close up on
 * the bead being laid, turning around it on its own or not, and the part in AR.
 */
export function PartCameraToolbar({
  partView,
  isLargeScreen,
  isXR,
}: {
  partView: Pick<
    PartViewState,
    "closeUp" | "setCloseUp" | "refocus" | "autoRotate" | "setAutoRotate"
  >;
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
            className="px-3 text-2xs data-active:hover:text-neutral-1000"
            title={`The whole part (${SHORTCUTS.reset.toUpperCase()})`}
            // Again on the part, even when already on it: the camera back to it.
            onClick={partView.refocus}
          >
            Whole part
          </TabsTrigger>
          <TabsTrigger
            value="bead"
            className="px-3 text-2xs data-active:hover:text-neutral-1000"
            title="Close up on the bead being laid, following the torch"
          >
            Weld bead
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <ToolbarDivider className="hidden sm:block" />
      {/* TODO: Improve the layout for small screens, so we can show the auto-rotate button on small screens too */}
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={partView.autoRotate}
        className={cn(
          "hidden sm:inline-flex gap-2",
          !partView.autoRotate && "opacity-50",
        )}
        title={
          partView.autoRotate
            ? "Stop the camera turning around on its own"
            : "Turn the camera around on its own"
        }
        onClick={() => partView.setAutoRotate(!partView.autoRotate)}
      >
        Auto-rotate
        <span className="inline-block min-w-[3ch] text-right text-3xs">
          {partView.autoRotate ? "ON" : "OFF"}
        </span>
      </Button>
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
