import { useCallback, useState } from "react";
import type { DefaultCameraController } from "@3dverse/livelink-react";

import { AssistProvider } from "../assist/AssistProvider";
import { IncidentDigestRecorder } from "../assist/IncidentDigestRecorder";
import { CameraEntityContext } from "../camera/cameraControl";
import CameraEventListener from "../camera/CameraEventListener";
import { usePointOfInterest } from "../camera/usePointOfInterest";
import { useViewerCameras } from "../camera/useViewerCameras";
import { ProductionStrip } from "../components/monitor/ProductionStrip";
import { PartCameraToolbar } from "../components/part/PartCameraToolbar";
import { EntityProvider } from "../components/TrainingPanel";
import { AutoWeld } from "../components/weld/AutoWeld";
import { useFroniusTorchByDefault } from "../components/weld/useFroniusTorchByDefault";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useResetCamera } from "../hooks/useResetCamera";
import { useSceneTheme, useSceneThemeWatcher } from "../hooks/useSceneTheme";
import { useViewSettings } from "../hooks/useViewSettings";
import { AssistChrome } from "../modes/AssistChrome";
import { MonitorChrome } from "../modes/MonitorChrome";
import { PartChrome } from "../modes/PartChrome";
import { usePartViewState } from "../modes/partViewState";
import { TrainingChrome } from "../modes/TrainingChrome";
import { useModeAttribute } from "../modes/useModeAttribute";
import {
  DIAGNOSTIC_POINT_OF_INTEREST,
  useModeCamera,
} from "../modes/useModeCamera";
import { useViewMode } from "../modes/useViewMode";
import { useKeyboardShortcuts } from "../shortcuts/useKeyboardShortcuts";
import { WeldBeads } from "../weldBead";
import { useEntityPicking } from "./useEntityPicking";
import { ViewerCanvas } from "./ViewerCanvas";
import { ViewerFooter } from "./ViewerFooter";
import { ViewerHeader } from "./ViewerHeader";
import { ViewerRightColumn } from "./ViewerRightColumn";

/**
 * The viewer once connected: the 3D view (`ViewerCanvas`) and what is around it, which depends on
 * what the viewer is for (`modes.ts`). The 3D view is the same in every mode; what is around it is
 * not. Training keeps every tool the viewer has had, mocks included.
 *
 * It holds what its parts share (the mode, the cameras, the selection, the part's view) and hands
 * it down; each part's own state is its own.
 */
export function ViewerLayout({
  machineName,
  sceneId,
  buildPlate,
  isXR = false,
}: {
  machineName: string;
  /** For the startup page's tile: the machine's last incident (`IncidentDigestRecorder`). */
  sceneId: string;
  /** Where the part in construction stands in the cell (`Machine.buildPlate`). */
  buildPlate?: string;
  /**
   * Inside `<WebXR>`: the DOM around the view only, no desktop `<Canvas>`. Livelink packs every
   * rendering surface into one streamed frame by its page rect, and the XR surface's rect is
   * always at (0, 0): a canvas left mounted lands on the eyes' image, as a second viewport
   * floating in the top left of the headset.
   */
  isXR?: boolean;
}) {
  // --- The URL and the device -----------------------------------------------------------------
  const { mode, setMode } = useViewMode();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  // --- Local state ----------------------------------------------------------------------------
  // State rather than a ref, so the toolbar and avatars re-render once the controller exists.
  const [cameraController, setCameraController] =
    useState<DefaultCameraController | null>(null);
  // Training's second 3D viewpoint, bottom right.
  const [isPipCameraOpen, setIsPipCameraOpen] = useState(false);
  // Monitor's alternate camera, bottom left: open by default, folded from its own title bar.
  const [isAltCameraOpen, setIsAltCameraOpen] = useState(true);
  // Where the mode's chrome portals its own panel, under the actions (`ViewerRightColumn`).
  const [rightSlot, setRightSlot] = useState<HTMLElement | null>(null);

  // --- Derived --------------------------------------------------------------------------------
  const isMonitorMode = mode === "monitor";
  const isPartMode = mode === "part";
  const isAssistMode = mode === "assistance";
  const isTrainingMode = mode === "training";
  // Large screens, Monitor, Part and the Diagnostic: the actions on the right.
  const hasRightColumn =
    isLargeScreen && (isMonitorMode || isPartMode || isAssistMode);

  // --- What the parts share -------------------------------------------------------------------
  // Toggled from the toolbar's View menu, in every mode, and remembered on this device. The
  // hologram HUD has its own joint gauges; the DOM ones (joint angles) are separate. The arc's
  // light while welding is an entity of the shared scene, for everyone.
  const { view, toggleView } = useViewSettings();
  const { cameraEntity, pipCameraEntity } = useViewerCameras(view);
  const {
    resetCamera,
    travelToPointOfView,
    isAtDefaultPosition,
    isStarted: isCameraStarted,
  } = useResetCamera(cameraController);
  // Where the Diagnostic looks at the cell from, in the scenes that say so.
  const diagnosticPointOfInterest = usePointOfInterest(
    DIAGNOSTIC_POINT_OF_INTEREST,
  );
  const { theme, toggleTheme } = useSceneTheme();
  const sceneTheme = theme ?? "light";
  // Selecting entities (a click, the pointer over them) is Training's.
  const { pickedEntity, hoveredEntity, onPick, onHover, pickInterceptor } =
    useEntityPicking({ enabled: isTrainingMode });
  // The part in construction: shown in the cell in Monitor, Part and Assistance; Part also has its
  // panels, brings the camera to the part and fades the arm.
  const partView = usePartViewState();

  // --- Callbacks ------------------------------------------------------------------------------
  // Monitor: a click on the part opens it in Part mode.
  const openPart = useCallback(() => setMode("part"), [setMode]);
  // Monitor and Part: to an incident's recovery, from their stop and assistance panel.
  const openAssistance = useCallback(() => setMode("assistance"), [setMode]);
  // Part and Assistance: their back buttons, to Monitor.
  const backToMonitor = useCallback(() => setMode("monitor"), [setMode]);
  const toggleAltCamera = useCallback(
    () => setIsAltCameraOpen((open) => !open),
    [],
  );
  const togglePipCamera = useCallback(
    () => setIsPipCameraOpen((open) => !open),
    [],
  );
  const closePipCamera = useCallback(() => setIsPipCameraOpen(false), []);

  // --- Effects --------------------------------------------------------------------------------
  useModeAttribute(mode);
  useSceneThemeWatcher();
  // The cell welds: the Fronius torch on the arm, not the milling spindle.
  useFroniusTorchByDefault();
  const { goToModeView } = useModeCamera({
    mode,
    resetCamera,
    travelToPointOfView,
    isCameraStarted,
    isAtDefaultPosition,
    diagnosticPointOfInterest,
    setPartCloseUp: partView.setCloseUp,
  });
  useKeyboardShortcuts({
    // In Part, back to the part rather than to the cell's default view.
    onReset: isPartMode ? partView.refocus : resetCamera,
    onToggleTheme: toggleTheme,
    onSelectMode: setMode,
  });

  return (
    <CameraEntityContext.Provider value={cameraEntity}>
      {/* In every mode: an incident opened in Assistance shows in all of them. */}
      <AssistProvider
        active={isAssistMode}
        cameraController={cameraController}
        pickInterceptor={pickInterceptor}
      >
        <IncidentDigestRecorder sceneId={sceneId} />
        {/* In every mode: welding while the machine runs, and the bead it lays. */}
        <AutoWeld />
        <WeldBeads />
        <EntityProvider>
          <ViewerHeader
            machineName={machineName}
            mode={mode}
            cameraController={cameraController}
            onOpenAssistance={openAssistance}
          />

          {isTrainingMode && (
            <TrainingChrome
              hoveredEntity={hoveredEntity}
              pickedEntity={pickedEntity}
            />
          )}
          {hasRightColumn && (
            <ViewerRightColumn
              mode={mode}
              onOpenAssistance={openAssistance}
              slotRef={setRightSlot}
            />
          )}
          {isMonitorMode && (
            <MonitorChrome
              onOpenAssistance={openAssistance}
              isAltCameraOpen={isAltCameraOpen}
              rightSlot={rightSlot}
            />
          )}
          {isAssistMode && (
            <AssistChrome
              onBack={backToMonitor}
              cameraController={cameraController}
              onRunEnd={goToModeView}
            />
          )}
          {/* The job, under the header, in every mode but Training. Below `lg`, all of it on one
              line, swiped sideways. */}
          {!isTrainingMode && (
            <ProductionStrip
              swipeable
              className="fixed top-16 left-4 right-4 z-40 starting:opacity-0 transition-opacity duration-500"
            />
          )}
          {isPartMode && (
            <PartChrome
              theme={sceneTheme}
              state={partView}
              plateMissing={!buildPlate}
              onOpenAssistance={openAssistance}
              onBack={backToMonitor}
              rightSlot={rightSlot}
              toolbar={
                <PartCameraToolbar
                  partView={partView}
                  isLargeScreen={isLargeScreen}
                  isXR={isXR}
                />
              }
            />
          )}
        </EntityProvider>
        <CameraEventListener />

        {!isXR && (
          <ViewerCanvas
            mode={mode}
            isLargeScreen={isLargeScreen}
            view={view}
            theme={sceneTheme}
            cameraEntity={cameraEntity}
            pipCameraEntity={pipCameraEntity}
            cameraController={cameraController}
            onCameraControllerChange={setCameraController}
            onHover={onHover}
            onPick={onPick}
            buildPlate={buildPlate}
            partView={partView}
            onOpenPart={openPart}
            isAltCameraOpen={isAltCameraOpen}
            onToggleAltCamera={toggleAltCamera}
            isPipCameraOpen={isPipCameraOpen}
            onClosePipCamera={closePipCamera}
          />
        )}

        <ViewerFooter
          mode={mode}
          onSelectMode={setMode}
          isLargeScreen={isLargeScreen}
          isXR={isXR}
          view={view}
          onToggleView={toggleView}
          theme={theme}
          onToggleTheme={toggleTheme}
          isPipCameraOpen={isPipCameraOpen}
          onTogglePipCamera={togglePipCamera}
          onResetCamera={resetCamera}
          isAtDefaultPosition={isAtDefaultPosition}
          isCameraReady={cameraController !== null}
        />
      </AssistProvider>
    </CameraEntityContext.Provider>
  );
}
