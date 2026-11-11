import {
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Livelink,
  Canvas,
  Viewport,
  CameraController,
  useCameraEntity,
  LivelinkContext,
  DefaultCameraController,
} from "@3dverse/livelink-react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router";

import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import { Button, cn, Icon, Tabs, TabsList, TabsTrigger } from "@3dverse/ui-lib";
import KeyboardHandler from "./keyBindings";
import CameraEventListener from "./camera/CameraEventListener";
import { SpeedProvider, EntityProvider } from "./components/TrainingPanel";
import { CameraEntityContext } from "./camera/cameraControl";
import { WebSocketProvider } from "./webSockets";
import { PartEntitiesProvider } from "./partEntitiesContext";
import { Avatars } from "./invite/Avatars";
import { JointAnglesOverlay } from "./components/joints/JointAnglesOverlay";
import { HoloHud } from "./components/holo/HoloHud";
import { Atmosphere } from "./components/Atmosphere";
import { WeldArc } from "./components/weld/WeldArc";
import { AutoWeld } from "./components/weld/AutoWeld";
import { useFroniusTorchByDefault } from "./components/weld/useFroniusTorchByDefault";
import { WeldBeads } from "./weldBead";
import { WebXR } from "@3dverse/livelink-webxr";
import { XRButton } from "./webXR";
import { XRStartMarker } from "./xr/xrStartMarker";
import { XRControllerActions } from "./xr/XRControllerActions";
import type { Entity, Transform } from "@3dverse/livelink";
import { MACHINES, PUBLIC_TOKEN } from "./config";
import { Toolbar } from "./components/Toolbar";
import { ResetPositionButton } from "./components/ResetPositionButton";
import { StartupScreen } from "./components/startup/StartupScreen";
import { NotFoundScreen } from "./components/startup/NotFoundScreen";
import {
  HOME_PATH,
  LEGACY_SCENE_ID_PARAM,
  SESSION_ID_PARAM,
  resolveViewerScene,
  viewerPath,
  type ViewerScene,
} from "./routing";
import { useResetCamera } from "./hooks/useResetCamera";
import { useWasDragged } from "./hooks/useWasDragged";
import { useKeyboardShortcuts } from "./shortcuts/useKeyboardShortcuts";
import { SHORTCUTS } from "./shortcuts/shortcuts";
import { useSceneTheme, useSceneThemeWatcher } from "./hooks/useSceneTheme";
import { useViewSettings } from "./hooks/useViewSettings";
import { cameraRenderSettings } from "./camera/renderSettings";
import { LiveBadge } from "./components/LiveBadge";
import { useViewMode } from "./modes/useViewMode";
import { ModeSwitcher } from "./modes/ModeSwitcher";
import { SecondaryToolbar } from "./components/common/SecondaryToolbar";
import { ViewMenu } from "./components/ViewMenu";
import { MonitorChrome } from "./modes/MonitorChrome";
import { WelcomePanel } from "./components/WelcomePanel";
import { DisconnectedModal } from "./components/DisconnectedModal";
import { XRSheet } from "./components/xr/XRSheet";
import { TrainingChrome } from "./modes/TrainingChrome";
import { PartChrome } from "./modes/PartChrome";
import { usePartViewState } from "./modes/partViewState";
import { PartInCell } from "./components/part/PartInCell";
import { SharedOverlayProvider } from "./components/holo/SharedOverlayProvider";
import { AssistProvider, type PickedPoint } from "./assist/AssistProvider";
import { IncidentDigestRecorder } from "./assist/IncidentDigestRecorder";
import { AssistChrome } from "./modes/AssistChrome";
import { AssistPins } from "./components/assist/AssistPins";
import { AssistCheckpoints } from "./components/assist/AssistCheckpoints";
import { AssistActions } from "./components/assist/AssistActions";
import {
  TertiaryToolbar,
  ToolbarDivider,
} from "./components/common/TertiaryToolbar";
import { ProductionStrip } from "./components/monitor/ProductionStrip";
import { RemoteActions } from "./components/monitor/RemoteActions";
import { PeopleSection } from "./components/assist/PeopleSection";
import { AltCamera } from "./components/monitor/AltCamera";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { AssistAlert } from "./components/assist/AssistAlert";

// The URLs themselves are described in `routing.ts`.
export function App() {
  return (
    <Routes>
      <Route index element={<HomeRoute />} />
      <Route path=":scene" element={<ViewerRoute />} />
      <Route path="*" element={<NotFoundScreen />} />
    </Routes>
  );
}

function HomeRoute() {
  const [searchParams] = useSearchParams();

  // An invite link from before the app had URLs: on to the machine's URL, same session.
  const sessionId = searchParams.get(SESSION_ID_PARAM);
  const sceneId = searchParams.get(LEGACY_SCENE_ID_PARAM);
  if (sessionId && sceneId) {
    return <Navigate replace to={viewerPath(sceneId, sessionId)} />;
  }

  return <StartupScreen />;
}

function ViewerRoute() {
  const { scene: segment = "" } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get(SESSION_ID_PARAM) ?? undefined;

  const scene = resolveViewerScene(segment);
  if (!scene) {
    return <NotFoundScreen />;
  }
  // `/NJ130-2.05` or a machine's scene UUID: shown under the machine's own URL.
  if (segment !== scene.segment) {
    return <Navigate replace to={viewerPath(scene.segment, sessionId)} />;
  }
  // Keyed, so going to another machine or session starts over with a fresh connection and state.
  return (
    <>
      {/* On a phone, as the machine opens. */}
      <WelcomePanel scene={scene} />
      <Viewer
        key={`${scene.sceneId}/${sessionId ?? ""}`}
        scene={scene}
        sessionId={sessionId}
      />
    </>
  );
}

function Viewer({
  scene,
  sessionId,
}: {
  scene: ViewerScene;
  sessionId?: string;
}) {
  const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
  // Where an XR session starts, from the scene's `xr_start` entity (`xrStartMarker.ts`).
  const [xrOrigin, setXROrigin] = useState<Partial<Transform>>();
  const buildPlate = MACHINES.find(
    (machine) => machine.sceneId === scene.sceneId,
  )?.buildPlate;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${scene.name} · VLM Vision`;
    return () => {
      document.title = previousTitle;
    };
  }, [scene.name]);

  // The viewer fills the screen and never scrolls: no page scrolling past it, no rubber band on
  // touch screens. Home, which does scroll, gets the body as it was.
  useEffect(() => {
    const { style } = document.body;
    const previous = {
      overflow: style.overflow,
      overscrollBehavior: style.overscrollBehavior,
    };
    style.overflow = "hidden";
    style.overscrollBehavior = "none";
    window.scrollTo(0, 0);
    return () => {
      style.overflow = previous.overflow;
      style.overscrollBehavior = previous.overscrollBehavior;
    };
  }, []);

  // Once the session is lost, the viewer's next action reconnects (`DisconnectedModal`): bumping
  // `Livelink`'s key remounts it, the only way to run its connection again. Out of XR first: a
  // session there only starts from a tap, not from a remount.
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const retryConnection = useCallback(() => {
    setXRMode(null);
    setConnectionAttempt((attempt) => attempt + 1);
  }, []);
  // Memoized: it is a component type, a new one each render would remount the modal mid-retry.
  const ConnectionErrorPanel = useCallback(
    ({ error }: { error: unknown }) => (
      <DisconnectedModal
        error={
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "The session was lost."
        }
        onRetry={retryConnection}
      />
    ),
    [retryConnection],
  );

  // Unmounting `Livelink` (Back to Home, browser back) disconnects from the session.
  return (
    <Livelink
      key={connectionAttempt}
      ConnectionErrorPanel={ConnectionErrorPanel}
      {...(sessionId
        ? { sessionId }
        : { sceneId: scene.sceneId, isTransient: false })}
      token={PUBLIC_TOKEN}
      LoadingPanel={LoadingOverlay}
    >
      <EntityProvider>
        <PartEntitiesProvider>
          <SpeedProvider>
            <WebSocketProvider>
              <KeyboardHandler />
              <XRStartMarker onChange={setXROrigin} />

              {xrMode ? (
                /* --- MODE CASQUE / IMMERSIF ACTIF --- */
                <WebXR
                  mode={xrMode}
                  // A copy: the rig writes `orientation` into the object it is given.
                  originTransform={xrOrigin && { ...xrOrigin }}
                  onSessionEnd={() => setXRMode(null)}
                  // The session could not start (permission refused, mode unavailable): back to
                  // the flat viewer, or this branch stays up with no 3D behind it.
                  onError={(error) => {
                    console.error("Could not start the XR session:", error);
                    setXRMode(null);
                  }}
                >
                  <XRControllerActions mode={xrMode} />
                  <AppLayout
                    isXR
                    machineName={scene.name}
                    sceneId={scene.sceneId}
                    buildPlate={buildPlate}
                    setXRMode={setXRMode}
                  />
                  <div className="fixed bottom-30 left-1/2 -translate-x-1/2">
                    <Button
                      size="lg"
                      variant="accent"
                      className="px-6 text-white!"
                      onClick={() => setXRMode(null)}
                    >
                      Exit XR
                    </Button>
                  </div>
                </WebXR>
              ) : (
                /* --- MODE NORMAL (Navigateur Classique) --- */
                <AppLayout
                  machineName={scene.name}
                  sceneId={scene.sceneId}
                  buildPlate={buildPlate}
                  setXRMode={setXRMode}
                />
              )}
            </WebSocketProvider>
          </SpeedProvider>
        </PartEntitiesProvider>
      </EntityProvider>
    </Livelink>
  );
}

function AppLayout({
  machineName,
  sceneId,
  buildPlate,
  setXRMode,
  isXR = false,
}: {
  machineName: string;
  /** For the startup page's tile: the machine's last incident (`IncidentDigestRecorder`). */
  sceneId: string;
  /** Where the part in construction stands in the cell (`Machine.buildPlate`). */
  buildPlate?: string;
  setXRMode: (mode: XRSessionMode) => void;
  /**
   * Inside `<WebXR>`: the DOM around the view only, no desktop `<Canvas>`. Livelink packs every
   * rendering surface into one streamed frame by its page rect, and the XR surface's rect is
   * always at (0, 0): a canvas left mounted lands on the eyes' image, as a second viewport
   * floating in the top left of the headset.
   */
  isXR?: boolean;
}) {
  // What the viewer is for (`modes.ts`). The 3D view is the same in every mode; what is around it
  // is not. Training keeps every tool the viewer has had, mocks included.
  const { mode, setMode } = useViewMode();
  const isTraining = mode === "training";
  // The mode on <html>, for the styles that follow it (Training's own accent colour, index.css).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = mode;
    return () => {
      delete root.dataset.mode;
    };
  }, [mode]);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const { cameraEntity } = useCameraEntity();
  const { cameraEntity: pipCamera } = useCameraEntity();
  // State rather than a ref, so the toolbar and avatars re-render once the controller exists.
  const [cameraController, setCameraController] =
    useState<DefaultCameraController | null>(null);
  const [showPipCamera, setShowPipCamera] = useState(false);
  // Monitor's alternate camera, bottom left: open by default, folded from its own title bar.
  const [isAltCameraOpen, setIsAltCameraOpen] = useState(true);
  // Toggled from the toolbar's View menu, in every mode, and remembered on this device. The
  // hologram HUD has its own joint gauges; the DOM ones (joint angles) are separate. The arc's
  // light while welding is an entity of the shared scene, for everyone.
  const { view, toggleView } = useViewSettings();

  const { instance } = useContext(LivelinkContext);

  // Selecting entities (a click, the pointer over them) is Training's. Read through a ref, so the
  // viewport's picking is not torn down and set up again at each mode switch.
  const isTrainingRef = useRef(isTraining);
  useEffect(() => {
    isTrainingRef.current = isTraining;
  }, [isTraining]);

  const [pickedEntity, setPickedEntity] = useState<{ entity: Entity } | null>(
    null,
  );
  // Assistance takes the click while a note is being placed on the cell (`AssistProvider`).
  const pickInterceptor = useRef<((picked: PickedPoint) => boolean) | null>(
    null,
  );
  // Turning the camera ends with a click too: that one picks nothing.
  const wasDragged = useWasDragged();
  const onPick = useCallback(
    (picked: PickedPoint | null) => {
      if (wasDragged.current) {
        return;
      }
      if (picked && pickInterceptor.current?.(picked)) {
        return;
      }
      if (isTrainingRef.current) {
        setPickedEntity(picked);
      }
    },
    [wasDragged],
  );
  const [hoveredEntity, setHoveredEntity] = useState<{ entity: Entity } | null>(
    null,
  );
  const onHover = useCallback((hovered: { entity: Entity } | null) => {
    setHoveredEntity(isTrainingRef.current ? hovered : null);
  }, []);
  // Out of Training, nothing stays selected.
  useEffect(() => {
    if (!isTraining) {
      setPickedEntity(null);
      setHoveredEntity(null);
    }
  }, [isTraining]);

  useEffect(() => {
    document.body.style.cursor = hoveredEntity ? "pointer" : "default";
    // Leaving the viewer while over an entity must not keep the pointer on the gallery.
    return () => {
      document.body.style.cursor = "default";
    };
  }, [hoveredEntity]);

  useEffect(() => {
    instance?.scene.highlightEntities({
      entities: pickedEntity ? [pickedEntity.entity] : [],
    });
  }, [pickedEntity]);

  useEffect(() => {
    let active = true;

    const loop = async () => {
      while (active) {
        if (!instance || !instance.scene) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        try {
          /* empty */
        } catch (e) {
          console.error("createEntity error:", e);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    loop();

    return () => {
      active = false;
    };
  }, [instance]);

  // The render graph's settings, on both of this viewer's cameras; some are in the View menu.
  const renderSettings = useMemo(
    () => cameraRenderSettings({ outlines: view.outlines, grid: view.grid }),
    [view.outlines, view.grid],
  );
  useEffect(() => {
    for (const camera of [cameraEntity, pipCamera]) {
      if (camera?.camera) {
        camera.camera.dataJSON = {
          ...camera.camera.dataJSON,
          ...renderSettings,
        };
      }
    }
  }, [cameraEntity, pipCamera, renderSettings]);

  const { resetCamera, isAtDefaultPosition } = useResetCamera(cameraController);

  useSceneThemeWatcher();
  // The cell welds: the Fronius torch on the arm, not the milling spindle.
  useFroniusTorchByDefault();
  const { theme, toggleTheme } = useSceneTheme();
  const sceneTheme = theme ?? "light";

  // The part in construction: shown in the cell in Monitor, Part and Assistance; Part also has its
  // panels, brings the camera to the part and fades the arm.
  const partView = usePartViewState();
  const isPart = mode === "part";
  const isAssist = mode === "assistance";
  const showPart = mode === "monitor" || isPart || isAssist;
  // Monitor: a click on the part opens it in Part mode.
  const openPart = useCallback(() => setMode("part"), [setMode]);
  // Monitor and Part: to an incident's recovery, from their stop and assistance panel.
  const openAssistance = useCallback(() => setMode("assistance"), [setMode]);
  // Part and Assistance: their back buttons, to Monitor.
  const backToMonitor = useCallback(() => setMode("monitor"), [setMode]);
  // Large screens, Monitor, Part and the Diagnostic: the actions on the right, the same panel from
  // one mode to the next; under them, the mode's own panel, portalled into this slot.
  const hasRightColumn = isLargeScreen && showPart;
  const [rightSlot, setRightSlot] = useState<HTMLElement | null>(null);

  // Switching modes: the camera back to the cell's default view. Not into Part, which brings it to
  // the part itself (`PartInCell`).
  const { setCloseUp: setPartCloseUp } = partView;
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

  useKeyboardShortcuts({
    // In Part, back to the part rather than to the cell's default view.
    onReset: isPart ? partView.refocus : resetCamera,
    onToggleTheme: toggleTheme,
    onSelectMode: setMode,
  });

  return (
    <CameraEntityContext.Provider value={cameraEntity}>
      {/* In every mode: an incident opened in Assistance shows in all of them. */}
      <AssistProvider
        active={isAssist}
        cameraController={cameraController}
        pickInterceptor={pickInterceptor}
      >
        <IncidentDigestRecorder sceneId={sceneId} />
        {/* In every mode: welding while the machine runs, and the bead it lays. */}
        <AutoWeld />
        <WeldBeads />
        <EntityProvider>
          {/* Below `lg`, it wraps before the toolbar on the right. */}
          <header
            className={cn(
              // A container: on a phone, its live badge is the dot alone (`LiveBadge`).
              "@container absolute top-0 left-0 px-3 py-4 md:px-4 flex justify-between items-center gap-x-1 w-full z-50",
              "starting:opacity-0 starting:-translate-y-4 transition-all duration-500",
            )}
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 starting:opacity-0 starting:-translate-y-4 transition-all duration-500">
              <Button
                as={Link}
                to={HOME_PATH}
                variant="ghost"
                size="icon-lg"
                className="text-primary"
                title="Back to Home"
                aria-label="Back to Home"
              >
                <Icon className="fas fa-arrow-left text-2xs" />
              </Button>
              <h1 className="font-orbitron text-xl font-bold mr-2 min-w-0 truncate">
                {machineName}
              </h1>
              {!isTraining && <LiveBadge collapsible />}

              {!isAssist && (
                <AssistAlert
                  onOpen={() => setMode("assistance")}
                  className="lg:ml-2"
                />
              )}
            </div>
            <Toolbar
              cameraController={cameraController}
              onOpenAssistance={openAssistance}
            />
          </header>

          {isTraining && (
            <TrainingChrome
              hoveredEntity={hoveredEntity?.entity ?? null}
              pickedEntity={pickedEntity?.entity ?? null}
            />
          )}
          {hasRightColumn && (
            <div
              className={cn(
                "fixed right-4 top-28 z-40 w-80 xl:w-96 flex flex-col gap-3",
                // Part: above its timeline, which runs under this column on most screens.
                isPart
                  ? "bottom-[calc(var(--spacing-navbar)+5.5rem)]"
                  : "bottom-navbar xl:bottom-4",
                "starting:opacity-0 starting:translate-x-4 transition-all duration-500",
              )}
            >
              <RemoteActions
                onOpenAssistance={openAssistance}
                inAssistance={isAssist}
                // Alone in the Diagnostic; over the mode's own panel elsewhere.
                className={cn(
                  "overflow-y-auto",
                  isAssist ? "min-h-0" : "shrink-0 max-h-[55%]",
                )}
              >
                {/* The Diagnostic: who is in the session, with the expert to ask for. */}
                {isAssist && <PeopleSection />}
              </RemoteActions>
              <div
                ref={setRightSlot}
                className="min-h-0 grow flex flex-col gap-3"
              />
            </div>
          )}
          {mode === "monitor" && (
            <MonitorChrome
              onOpenAssistance={openAssistance}
              isAltCameraOpen={isAltCameraOpen}
              rightSlot={rightSlot}
            />
          )}
          {isAssist && (
            <AssistChrome
              onBack={backToMonitor}
              cameraController={cameraController}
              onResetCamera={resetCamera}
            />
          )}
          {/* The job, under the header, in every mode but Training. Below `lg`, all of it on one
              line, swiped sideways. */}
          {!isTraining && (
            <ProductionStrip
              swipeable
              className="fixed top-16 left-4 right-4 z-40 starting:opacity-0 transition-opacity duration-500"
            />
          )}
          {isPart && (
            <PartChrome
              theme={sceneTheme}
              state={partView}
              plateMissing={!buildPlate}
              onOpenAssistance={openAssistance}
              onBack={backToMonitor}
              rightSlot={rightSlot}
              // Over the timeline: the camera on the part or on the bead, and the part in AR.
              toolbar={
                <TertiaryToolbar aria-label="Camera and AR" inFlow>
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
                  {/* Below `lg`, AR is entered from the XR button (`XRSheet`). */}
                  {isLargeScreen && (
                    <>
                      <ToolbarDivider />
                      <XRButton
                        mode="immersive-ar"
                        text="Open in"
                        variant="ghost"
                        icon="fa-cube"
                        setXRMode={setXRMode}
                      />
                    </>
                  )}
                </TertiaryToolbar>
              }
            />
          )}
        </EntityProvider>
        <CameraEventListener />

        {!isXR && (
          <Canvas className="w-full h-dvh">
            <Viewport
              cameraEntity={cameraEntity}
              className="w-full h-full"
              setHoveredEntity={onHover}
              setPickedEntity={onPick}
            >
              {/* Under every other overlay, so they stay crisp over it. */}
              {view.atmosphere && <Atmosphere theme={sceneTheme} />}

              <CameraController
                ref={(controller) => setCameraController(controller ?? null)}
              />

              <Avatars cameraController={cameraController} />
              {/* The points of the robot the operator checks. */}
              {isAssist && <AssistCheckpoints />}
              {/* After the checkpoints: the notes go over them. */}
              {isAssist && <AssistPins />}

              {/* One overlay over the stream, for the HUD and the part. */}
              <SharedOverlayProvider>
                {/* Not in Part, where the arm fades away. Their View settings stay as they are. */}
                {view.holo && !isPart && <HoloHud />}

                {buildPlate && showPart && (
                  <PartInCell
                    plateEuid={buildPlate}
                    xray={isPart}
                    // Monitor shows where the build left its window, at a glance.
                    metric={isPart ? partView.metric : "deviation"}
                    theme={sceneTheme}
                    shownLayer={
                      isPart ? (partView.pinnedLayer ?? Infinity) : Infinity
                    }
                    focusLayer={isPart ? partView.focusLayer : null}
                    onHover={partView.setHover}
                    cameraController={cameraController}
                    focusSignal={partView.focusSignal}
                    // Held still while the build replays, or a past layer is shown.
                    orbitPaused={isPart && partView.pinnedLayer !== null}
                    closeUp={isPart && partView.closeUp}
                    onOpen={mode === "monitor" ? openPart : undefined}
                  />
                )}
              </SharedOverlayProvider>

              {/* The welding arc at the torch tip, while the machine runs or "Start Weld" is on. */}
              <WeldArc showEffect={view.weldArc} />

              {view.jointAngles && !isPart && <JointAnglesOverlay />}

              {/* Monitor's alternate camera: under the left column, large screens only. */}
              {mode === "monitor" && isLargeScreen && (
                <AltCamera
                  cameraEntity={pipCamera}
                  open={isAltCameraOpen}
                  onToggle={() => setIsAltCameraOpen((open) => !open)}
                  // The part as Part mode shows it, turning; a click opens Part.
                  onOpen={openPart}
                  plateEuid={buildPlate}
                  metric={partView.metric}
                  theme={sceneTheme}
                  // The viewer's session: one of the card's own would keep this Canvas in XR.
                  setXRMode={setXRMode}
                  className="absolute left-4 bottom-toolbar z-40 w-64 xl:w-72"
                />
              )}
              {isTraining && showPipCamera && (
                <div className="absolute bottom-3 max-lg:bottom-navbar right-3 z-50 w-1/4 aspect-video border border-tertiary shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
                  <Viewport cameraEntity={pipCamera} className="w-full h-full">
                    <CameraController />
                  </Viewport>
                  <Button
                    variant="overlay"
                    size="icon-xs"
                    className="absolute top-1 left-1"
                    onClick={() => setShowPipCamera(false)}
                  >
                    <Icon className="fas fa-angles-down -rotate-45 opacity-60" />
                  </Button>
                </div>
              )}
            </Viewport>
          </Canvas>
        )}

        <footer className="absolute bottom-0 left-0 right-0 pointer-events-none z-50">
          {/* In every mode, docked in the bottom-left corner: what the view shows, then XR. */}
          <SecondaryToolbar aria-label="View and extended reality">
            <ViewMenu
              view={view}
              onToggle={toggleView}
              cellHidden={mode === "part"}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
            {/* VR and AR: large screens only. Below `lg`, the XR button on the right (`XRSheet`). */}
            <span
              aria-hidden
              className="max-lg:hidden h-full mx-0.5 border-l border-secondary"
            />
            <XRButton
              mode="immersive-vr"
              text=""
              variant="ghost"
              setXRMode={setXRMode}
              className="max-lg:hidden"
            />
            <XRButton
              mode="immersive-ar"
              text=""
              variant="ghost"
              setXRMode={setXRMode}
              className="max-lg:hidden"
            />
          </SecondaryToolbar>
          {!isLargeScreen && <XRSheet setXRMode={setXRMode} />}

          {/* At the bottom centre, over the modes: the camera, and what one does on the cell. Part
              has its own, over its timeline (`PartChrome`). */}
          {!isPart && (
            <TertiaryToolbar aria-label="Camera and notes">
              {/* Assistance: pin a note, follow the other side's camera. */}
              {isAssist && <AssistActions />}
              {/* Training: a second 3D viewpoint, not one of the cell's cameras. */}
              {isTraining && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={showPipCamera}
                  className={cn(showPipCamera && "text-accent-300")}
                  title="A second 3D viewpoint"
                  onClick={() => setShowPipCamera((prev) => !prev)}
                >
                  <Icon className="fas fa-video text-2xs" />
                  <span className="hidden sm:inline">Alt. camera</span>
                </Button>
              )}
              <ResetPositionButton
                variant="toolbar"
                onReset={resetCamera}
                isAtDefaultPosition={isAtDefaultPosition}
                disabled={!cameraController}
              />
            </TertiaryToolbar>
          )}

          {/* Docked at the bottom centre: what else stands there goes above it (`bottom-navbar`). */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <ModeSwitcher mode={mode} onSelect={setMode} />
          </div>
        </footer>
      </AssistProvider>
    </CameraEntityContext.Provider>
  );
}

export default App;
