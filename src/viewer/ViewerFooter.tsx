import { Button, cn, Icon } from "@3dverse/ui-lib";

import { AssistActions } from "../components/assist/AssistActions";
import { SecondaryToolbar } from "../components/common/SecondaryToolbar";
import {
  TertiaryToolbar,
  ToolbarDivider,
} from "../components/common/TertiaryToolbar";
import { ResetPositionButton } from "../components/ResetPositionButton";
import { ViewMenu } from "../components/ViewMenu";
import { XRSheet } from "../components/xr/XRSheet";
import type { SceneTheme } from "../hooks/useSceneTheme";
import type { ViewSetting, ViewSettings } from "../hooks/useViewSettings";
import { ModeSwitcher } from "../modes/ModeSwitcher";
import type { ViewMode } from "../modes/modes";
import { isHeadset } from "../utils/isHeadset";
import { XRButton } from "../webXR";
import { MiniToast } from "../xr/MiniToast";

/**
 * The viewer's footer, in every mode: bottom left, what the view shows, then XR; at the bottom
 * centre, a column in the flow, at every screen width: the camera and what one does on the cell
 * (`TertiaryToolbar`), the line confirming what was just done (`MiniToast`), then the modes
 * (`ModeSwitcher`). Nothing in the column is placed by itself, so nothing in it can overlap.
 */
export function ViewerFooter({
  mode,
  onSelectMode,
  isLargeScreen,
  isXR,
  view,
  onToggleView,
  theme,
  onToggleTheme,
  isPipCameraOpen,
  onTogglePipCamera,
  onResetCamera,
  isAtDefaultPosition,
  isCameraReady,
}: {
  mode: ViewMode;
  onSelectMode: (mode: ViewMode) => void;
  isLargeScreen: boolean;
  /** During an XR session, which has its own controls (`XRHud`). */
  isXR: boolean;
  /** What the View menu toggles (`useViewSettings`). */
  view: ViewSettings;
  onToggleView: (setting: ViewSetting) => void;
  /** The scene's theme; `null` until it is known. */
  theme: SceneTheme | null;
  onToggleTheme: () => void;
  /** Training's second 3D viewpoint (`ViewerCanvas`). */
  isPipCameraOpen: boolean;
  onTogglePipCamera: () => void;
  /** The camera back to the scene's default point of view (`useResetCamera`). */
  onResetCamera: () => void;
  isAtDefaultPosition: boolean;
  /** The main camera's controller exists: there is a camera to reset. */
  isCameraReady: boolean;
}) {
  const isPartMode = mode === "part";
  const isAssistMode = mode === "assistance";
  const isTrainingMode = mode === "training";

  return (
    // Fixed, as its corner toolbars are: docked to the viewport's bottom, and what spills out of it
    // (the confirming line's halo, wider than a phone) does not widen the page.
    <footer className="fixed bottom-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none">
      {/* In every mode, docked in the bottom-left corner: what the view shows, then XR. */}
      <SecondaryToolbar aria-label="View and extended reality">
        <ViewMenu
          view={view}
          onToggle={onToggleView}
          cellHidden={isPartMode}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        {/* VR and AR: large screens only. Below `lg`, the XR button on the right (`XRSheet`).
            Neither during a session, which has its own controls (`XRHud`). */}
        {!isXR && !isHeadset && (
          <>
            <span
              aria-hidden
              className="max-lg:hidden h-full mx-0.5 border-l border-secondary"
            />
            <XRButton
              mode="immersive-vr"
              text=""
              variant="ghost"
              className="max-lg:hidden"
            />
            <XRButton
              mode="immersive-ar"
              text=""
              variant="ghost"
              className="max-lg:hidden"
            />
          </>
        )}
      </SecondaryToolbar>
      {!isLargeScreen && !isXR && !isHeadset && <XRSheet />}

      {/* The top of the column: the camera, and what one does on the cell. Part has its own, over
          its timeline (`PartCameraToolbar`). */}
      {!isPartMode && (
        <TertiaryToolbar aria-label="Camera and notes">
          {/* Assistance: pin a note, follow the other side's camera. */}
          {isAssistMode && (
            <>
              <AssistActions />
              <ToolbarDivider />
            </>
          )}
          {/* Training: a second 3D viewpoint, not one of the cell's cameras. */}
          {isTrainingMode && (
            <>
              <Button
                variant="ghost"
                size="xs"
                aria-pressed={isPipCameraOpen}
                className={cn("gap-2", isPipCameraOpen && "text-accent-300")}
                title="A second 3D viewpoint"
                onClick={onTogglePipCamera}
              >
                <Icon className="fas fa-video text-3xs" />
                <span className="hidden sm:inline">Alt. camera</span>
              </Button>
              <ToolbarDivider />
            </>
          )}
          <ResetPositionButton
            onReset={onResetCamera}
            isAtDefaultPosition={isAtDefaultPosition}
            disabled={!isCameraReady}
          />
        </TertiaryToolbar>
      )}

      {/* Between the toolbar and the modes: the line confirming what was just done. Its row is
          always there, so the toolbar does not move as a line comes and goes. In Part it is the
          room left under the timeline, which stands on the navbar's spacing (`bottom-navbar`). */}
      <MiniToast
        className={cn("w-72 max-w-full", isPartMode ? "h-7" : "h-10")}
      />

      {/* The foot of the column: what else stands at the bottom centre goes above it. */}
      <ModeSwitcher mode={mode} onSelect={onSelectMode} />
    </footer>
  );
}
