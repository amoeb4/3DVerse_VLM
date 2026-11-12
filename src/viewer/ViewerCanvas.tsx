import {
  Canvas,
  CameraController,
  Viewport,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { Button, Icon, cn } from "@3dverse/ui-lib";

import type { PickedPoint } from "../assist/AssistProvider";
import { AssistCheckpoints } from "../components/assist/AssistCheckpoints";
import { AssistPins } from "../components/assist/AssistPins";
import { Haze } from "../components/Haze";
import { HoloHud } from "../components/holo/HoloHud";
import { SharedOverlayProvider } from "../components/holo/SharedOverlayProvider";
import { JointAnglesOverlay } from "../components/joints/JointAnglesOverlay";
import { AltCamera } from "../components/monitor/AltCamera";
import { PartInCell } from "../components/part/PartInCell";
import { WeldArc } from "../components/weld/WeldArc";
import type { Theme } from "../hooks/useTheme";
import type { ViewSettings } from "../hooks/useViewSettings";
import { Avatars } from "../invite/Avatars";
import type { ViewMode } from "../modes/modes";
import type { PartViewState } from "../modes/partViewState";

/**
 * The 3D view: the canvas, its viewport on the main camera, and everything drawn in it or over the
 * stream. The same in every mode but for what is drawn over it: the part, the Diagnostic's
 * checkpoints and notes, the picture-in-picture cameras.
 *
 * Not rendered inside `<WebXR>`: see `ViewerLayout`'s `isXR`.
 */
export function ViewerCanvas({
  mode,
  isLargeScreen,
  view,
  theme,
  cameraEntity,
  pipCameraEntity,
  cameraController,
  onCameraControllerChange,
  onHover,
  onPick,
  buildPlate,
  partView,
  onOpenPart,
  isAltCameraOpen,
  onToggleAltCamera,
  isPipCameraOpen,
  onClosePipCamera,
}: {
  mode: ViewMode;
  isLargeScreen: boolean;
  /** What the View menu toggles (`useViewSettings`). */
  view: ViewSettings;
  theme: Theme;
  cameraEntity: Entity | null;
  /** The camera of the picture-in-picture views: Monitor's alternate camera, Training's second viewpoint. */
  pipCameraEntity: Entity | null;
  cameraController: DefaultCameraController | null;
  /** The main camera's controller, once it exists; `null` once it is gone. */
  onCameraControllerChange: (
    controller: DefaultCameraController | null,
  ) => void;
  /** The viewport's picking (`useEntityPicking`). */
  onHover: (hovered: { entity: Entity } | null) => void;
  onPick: (picked: PickedPoint | null) => void;
  /** Where the part in construction stands in the cell (`Machine.buildPlate`). */
  buildPlate?: string;
  partView: PartViewState;
  /** Monitor: a click on the part opens it in Part mode. */
  onOpenPart: () => void;
  /** Monitor's alternate camera, bottom left: open, or folded to its title bar. */
  isAltCameraOpen: boolean;
  onToggleAltCamera: () => void;
  /** Training's second 3D viewpoint, bottom right. */
  isPipCameraOpen: boolean;
  onClosePipCamera: () => void;
}) {
  const isMonitorMode = mode === "monitor";
  const isPartMode = mode === "part";
  const isAssistMode = mode === "assistance";
  const isTrainingMode = mode === "training";
  // The part in construction: shown in the cell in Monitor, Part and Assistance.
  const isPartShown = !isTrainingMode;

  return (
    <Canvas className="w-full h-dvh">
      <Viewport
        cameraEntity={cameraEntity}
        className="w-full h-full"
        setHoveredEntity={onHover}
        setPickedEntity={onPick}
      >
        <Haze theme={theme} />

        <CameraController
          ref={(controller) => onCameraControllerChange(controller ?? null)}
        />

        <Avatars cameraController={cameraController} />
        {/* The points of the robot the operator checks. */}
        {isAssistMode && <AssistCheckpoints />}
        {/* After the checkpoints: the notes go over them. */}
        {isAssistMode && <AssistPins />}

        {/* One overlay over the stream, for the HUD and the part. */}
        <SharedOverlayProvider>
          {/* Not in Part, where the arm fades away. Their View settings stay as they are. */}
          {view.holo && !isPartMode && <HoloHud />}

          {buildPlate && isPartShown && (
            <PartInCell
              plateEuid={buildPlate}
              xray={isPartMode}
              // Monitor shows where the build left its window, at a glance.
              metric={isPartMode ? partView.metric : "deviation"}
              theme={theme}
              shownLayer={
                isPartMode ? (partView.pinnedLayer ?? Infinity) : Infinity
              }
              focusLayer={isPartMode ? partView.focusLayer : null}
              onHover={partView.setHover}
              cameraController={cameraController}
              focusSignal={partView.focusSignal}
              // Held still while the build replays, or a past layer is shown.
              orbitPaused={isPartMode && partView.pinnedLayer !== null}
              closeUp={isPartMode && partView.closeUp}
              onOpen={isMonitorMode ? onOpenPart : undefined}
            />
          )}
        </SharedOverlayProvider>

        {/* The welding arc at the torch tip, while the machine runs or "Start Weld" is on. */}
        <WeldArc showEffect={view.arcSparkles} />

        {view.jointAngles && !isPartMode && <JointAnglesOverlay />}

        {/* Monitor's alternate camera: under the left column, large screens only. */}
        {isMonitorMode && isLargeScreen && (
          <AltCamera
            cameraEntity={pipCameraEntity}
            open={isAltCameraOpen}
            onToggle={onToggleAltCamera}
            // The part as Part mode shows it, turning; a click opens Part.
            onOpen={onOpenPart}
            plateEuid={buildPlate}
            metric={partView.metric}
            theme={theme}
            className="absolute left-4 bottom-toolbar z-40 w-64 xl:w-72"
          />
        )}
        {isTrainingMode && isPipCameraOpen && (
          <PipCamera
            cameraEntity={pipCameraEntity}
            onClose={onClosePipCamera}
          />
        )}
      </Viewport>
    </Canvas>
  );
}

/** Training: a second 3D viewpoint, not one of the cell's cameras. */
function PipCamera({
  cameraEntity,
  onClose,
}: {
  cameraEntity: Entity | null;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute bottom-0 md:bottom-3 md:max-lg:bottom-navbar right-0 md:right-3 z-50 w-full md:w-1/4 aspect-video",
        "border-t md:border border-tertiary shadow-[0_10px_30px_rgba(0,0,0,0.1)]",
      )}
    >
      <Viewport cameraEntity={cameraEntity} className="w-full h-full">
        <CameraController />
      </Viewport>
      <Button
        variant="overlay"
        size="icon-xs"
        className="absolute top-1 left-1"
        onClick={onClose}
      >
        <Icon className="fas fa-angles-down -rotate-45 opacity-60" />
      </Button>
    </div>
  );
}
