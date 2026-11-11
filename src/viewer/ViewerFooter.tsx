import { Button, cn, Icon } from "@3dverse/ui-lib";

import { AssistActions } from "../components/assist/AssistActions";
import { SecondaryToolbar } from "../components/common/SecondaryToolbar";
import { TertiaryToolbar } from "../components/common/TertiaryToolbar";
import { ResetPositionButton } from "../components/ResetPositionButton";
import { ViewMenu } from "../components/ViewMenu";
import { XRSheet } from "../components/xr/XRSheet";
import type { SceneTheme } from "../hooks/useSceneTheme";
import type { ViewSetting, ViewSettings } from "../hooks/useViewSettings";
import { ModeSwitcher } from "../modes/ModeSwitcher";
import type { ViewMode } from "../modes/modes";
import { isHeadset } from "../utils/isHeadset";
import { XRButton } from "../webXR";

/**
 * The viewer's footer, in every mode: bottom left, what the view shows, then XR; at the bottom
 * centre, the camera and what one does on the cell, over the modes (`ModeSwitcher`).
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
    <footer className="absolute bottom-0 left-0 right-0 pointer-events-none z-50">
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

      {/* At the bottom centre, over the modes: the camera, and what one does on the cell. Part
          has its own, over its timeline (`PartCameraToolbar`). */}
      {!isPartMode && (
        <TertiaryToolbar aria-label="Camera and notes">
          {/* Assistance: pin a note, follow the other side's camera. */}
          {isAssistMode && <AssistActions />}
          {/* Training: a second 3D viewpoint, not one of the cell's cameras. */}
          {isTrainingMode && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={isPipCameraOpen}
              className={cn(isPipCameraOpen && "text-accent-300")}
              title="A second 3D viewpoint"
              onClick={onTogglePipCamera}
            >
              <Icon className="fas fa-video text-2xs" />
              <span className="hidden sm:inline">Alt. camera</span>
            </Button>
          )}
          <ResetPositionButton
            variant="toolbar"
            onReset={onResetCamera}
            isAtDefaultPosition={isAtDefaultPosition}
            disabled={!isCameraReady}
          />
        </TertiaryToolbar>
      )}

      {/* Docked at the bottom centre: what else stands there goes above it (`bottom-navbar`). */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <ModeSwitcher mode={mode} onSelect={onSelectMode} />
      </div>
    </footer>
  );
}
