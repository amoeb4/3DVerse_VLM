import { useState, useContext, useEffect, useCallback } from "react";
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
import { Button, cn, Icon } from "@3dverse/ui-lib";
import KeyboardHandler from "./keyBindings";
import CameraEventListener from "./camera/CameraEventListener";
import ControlPanel, { SpeedProvider, EntityProvider } from "./components/ControlPanel";
import { CameraEntityContext } from "./camera/cameraControl";
import { WebSocketProvider } from "./webSockets";
import { PartEntitiesProvider } from "./partEntitiesContext";
import { Avatars } from "./invite/Avatars";
import { JointAnglesOverlay } from "./components/joints/JointAnglesOverlay";
import { HoloHud } from "./components/holo/HoloHud";
import { EntityCreator } from "./weldBead";
import { EntityStatusPanel } from "./components/EntityPicking";
import { XRButton } from "./webXR";
import type { Entity } from "@3dverse/livelink";
import { PUBLIC_TOKEN } from "./config";
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
import { useKeyboardShortcuts } from "./shortcuts/useKeyboardShortcuts";
import { useSceneTheme, useSceneThemeWatcher } from "./hooks/useSceneTheme";
import { ButtonGroup } from "./components/common/ButtonGroup";

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
    <Viewer
      key={`${scene.sceneId}/${sessionId ?? ""}`}
      scene={scene}
      sessionId={sessionId}
    />
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

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${scene.name} · VLM Vision`;
    return () => {
      document.title = previousTitle;
    };
  }, [scene.name]);

  // Unmounting `Livelink` (Back to Home, browser back) disconnects from the session.
  return (
    <Livelink
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

              {xrMode ? (
                /* --- MODE CASQUE / IMMERSIF ACTIF --- */
                <WebXR mode={xrMode} onSessionEnd={() => setXRMode(null)}>
                  <AppLayout machineName={scene.name} setXRMode={setXRMode} />
                  <div className="fixed top-4 left-4 flex items-center justify-center gap-4 z-99999">
                    <Button
                      variant="overlay-outline"
                      className="before:opacity-100 before:backdrop-blur-xl"
                      onClick={() => setXRMode(null)}
                    >
                      Exit XR
                    </Button>

                    {xrMode !== "immersive-ar" && (
                      <XRButton
                        mode="immersive-ar"
                        text="Switch to"
                        setXRMode={setXRMode}
                      />
                    )}

                    {xrMode !== "immersive-vr" && (
                      <XRButton
                        mode="immersive-vr"
                        text="Switch to"
                        setXRMode={setXRMode}
                      />
                    )}
                  </div>
                </WebXR>
              ) : (
                /* --- MODE NORMAL (Navigateur Classique) --- */
                <AppLayout machineName={scene.name} setXRMode={setXRMode} />
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
  setXRMode,
}: {
  machineName: string;
  setXRMode: (mode: XRSessionMode) => void;
}) {
  const { cameraEntity } = useCameraEntity();
  const { cameraEntity: pipCamera } = useCameraEntity();
  // State rather than a ref, so the toolbar and avatars re-render once the controller exists.
  const [cameraController, setCameraController] =
    useState<DefaultCameraController | null>(null);
  const [showPipCamera, setShowPipCamera] = useState(false);
  // The hologram HUD has its own joint gauges; the DOM ones stay available from the toolbar.
  const [showDOM3D, setShowDOM3D] = useState(false);
  const [showHolo, setShowHolo] = useState(false);

  const { instance } = useContext(LivelinkContext);

  const [pickedEntity, setPickedEntity] = useState<{ entity: Entity } | null>(
    null,
  );
  const [hoveredEntity, setHoveredEntity] = useState<{ entity: Entity } | null>(
    null,
  );

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

  useEffect(() => {
    if (!cameraEntity?.camera) return;
    const { dataJSON } = cameraEntity.camera;
    cameraEntity.camera.dataJSON = {
      ...dataJSON,
      ambientBRDF: true,
      ambientSpecular: true,
      drawGrid: false,
      edgeOnSelf: true,
      edgeOutlines: true,
      filterSpecular: true,
      grid: false,
      sharpen: true,
    };
  }, [cameraEntity]);

  useEffect(() => {
    if (!pipCamera?.camera) return;

    const { dataJSON } = pipCamera.camera;

    pipCamera.camera.dataJSON = {
      ...dataJSON,
      ambientBRDF: true,
      ambientSpecular: true,
      drawGrid: false,
      edgeOnSelf: true,
      edgeOutlines: true,
      filterSpecular: true,
      grid: false,
      sharpen: true,
    };
  }, [pipCamera]);

  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);

  const onToggleControlPanel = useCallback(() => {
    setIsControlPanelOpen((prev) => !prev);
  }, []);

  const onCloseControlPanel = useCallback(() => {
    setIsControlPanelOpen(false);
  }, []);

  const { resetCamera, isAtDefaultPosition } = useResetCamera(cameraController);

  useSceneThemeWatcher();
  const { theme, toggleTheme } = useSceneTheme();

  useKeyboardShortcuts({
    onReset: resetCamera,
    onToggleControlPanel,
    onCloseControlPanel,
    onToggleTheme: toggleTheme,
  });

  return (
    <CameraEntityContext.Provider value={cameraEntity}>
      <EntityProvider>
        <header
          className={cn(
            "absolute top-4 left-4 flex items-center gap-1 z-50",
            "starting:opacity-0 starting:-translate-y-4 transition-all duration-500",
          )}
        >
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
          <h1 className="text-xl font-bold">{machineName}</h1>
        </header>
        <Toolbar
          cameraController={cameraController}
          onToggleControlPanel={onToggleControlPanel}
          showDOM3D={showDOM3D}
          setShowDOM3D={setShowDOM3D}
          showHolo={showHolo}
          setShowHolo={setShowHolo}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <ControlPanel
          isOpen={isControlPanelOpen}
          onClose={onCloseControlPanel}
        />
        {/* <DisplayDashboard /> */}
      </EntityProvider>

      <CameraEventListener />

      <Canvas className="w-full h-screen">
        <Viewport
          cameraEntity={cameraEntity}
          className="w-full h-full"
          setHoveredEntity={setHoveredEntity}
          setPickedEntity={setPickedEntity}
        >
          <CameraController
            ref={(controller) => setCameraController(controller ?? null)}
          />

          <Avatars cameraController={cameraController} />

          {showHolo && <HoloHud />}

          {showDOM3D && <JointAnglesOverlay />}

          {showPipCamera && (
            <div className="absolute bottom-3 right-3 z-50 w-1/4 aspect-video border border-tertiary shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
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

        <EntityCreator />

        <EntityStatusPanel
          hoveredEntity={hoveredEntity?.entity ?? null}
          pickedEntity={pickedEntity?.entity ?? null}
        />
      </Canvas>

      <footer
        className={cn(
          "absolute bottom-0 left-0 right-0 grid grid-cols-3 gap-4 p-4 pointer-events-none z-50",
          "starting:opacity-0 starting:translate-y-8 transition-all duration-500",
        )}
      >
        <div className="place-self-start [align-self:end] pointer-events-auto">
          <ButtonGroup>
            <XRButton mode="immersive-vr" text="" setXRMode={setXRMode} />
            <XRButton mode="immersive-ar" text="" setXRMode={setXRMode} />
          </ButtonGroup>
        </div>
        <div className="place-self-center mb-16 pointer-events-auto">
          <ResetPositionButton
            onReset={resetCamera}
            isAtDefaultPosition={isAtDefaultPosition}
            disabled={!cameraController}
          />
        </div>

        <div className="place-self-end pointer-events-auto">
          <Button
            variant="overlay-outline"
            className="before:opacity-100 before:backdrop-blur-xl"
            onClick={() => setShowPipCamera((prev) => !prev)}
          >
            Alt. Camera
            <Icon className="fas fa-video text-2xs" />
          </Button>
        </div>
      </footer>
    </CameraEntityContext.Provider>
  );
}

export default App;
