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

import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import { Button, cn, Icon } from "@3dverse/ui-lib";
import KeyboardHandler from "./keyBindings";
import CameraEventListener from "./camera/CameraEventListener";
import ControlPanel, { SpeedProvider, EntityProvider } from "./Interface";
import { CameraEntityContext } from "./camera/cameraControl";
import { WebSocketProvider } from "./webSockets";
import { PartEntitiesProvider } from "./partEntitiesContext";
import { Avatars } from "./invite/Avatars";
import Dom3DInfos from "./components/DOM3Dinfos";
import { EntityCreator } from "./weldBead";
import { EntityStatusPanel } from "./components/EntityPicking";
import { XRButton } from "./webXR";
import type { Entity } from "@3dverse/livelink";
import { PUBLIC_TOKEN, MACHINES } from "./config";
import { Toolbar } from "./components/Toolbar";
import { SCENE_ID_PARAM, SESSION_ID_PARAM } from "./invite/InvitePanel";
import { ResetPositionButton } from "./components/ResetPositionButton";
import { StartupPanel } from "./components/StartupPanel";
import { useResetCamera } from "./hooks/useResetCamera";
import { useKeyboardShortcuts } from "./shortcuts/useKeyboardShortcuts";

type SceneSelection = { sceneId: string; name: string; sessionId?: string };

// An invite link (see `InvitePanel`) names the session to join, so it skips the scene picker.
function selectionFromInviteLink(): SceneSelection | null {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get(SESSION_ID_PARAM);
  if (!sessionId) {
    return null;
  }
  const sceneId = params.get(SCENE_ID_PARAM) ?? "";
  const machine = MACHINES.find((m) => m.sceneId === sceneId);
  return { sceneId, sessionId, name: machine?.name ?? "Shared session" };
}

export function App() {
  const [credentials, setCredentials] = useState<SceneSelection | null>(
    selectionFromInviteLink,
  );
  const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);

  if (!credentials) {
    return <StartupPanel onSubmit={setCredentials} />;
  }
  return (
    <Livelink
      {...(credentials.sessionId
        ? { sessionId: credentials.sessionId }
        : { sceneId: credentials.sceneId, isTransient: false })}
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
                  <AppLayout
                    machineName={credentials.name}
                    setXRMode={setXRMode}
                  />
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
                <AppLayout
                  machineName={credentials.name}
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
  const [showDOM3D, setShowDOM3D] = useState(true);

  const { instance } = useContext(LivelinkContext);

  const [pickedEntity, setPickedEntity] = useState<{ entity: Entity } | null>(
    null,
  );
  const [hoveredEntity, setHoveredEntity] = useState<{ entity: Entity } | null>(
    null,
  );

  useEffect(() => {
    document.body.style.cursor = hoveredEntity ? "pointer" : "default";
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

  const { resetCamera, isAtDefaultPosition } = useResetCamera(cameraController);

  useKeyboardShortcuts({ onReset: resetCamera, onToggleControlPanel });

  return (
    <CameraEntityContext.Provider value={cameraEntity}>
      <EntityProvider>
        <header className="absolute top-4 left-7 z-50">
          <h1 className="text-xl font-bold">{machineName}</h1>
        </header>
        <Toolbar
          cameraController={cameraController}
          onToggleControlPanel={onToggleControlPanel}
          showDOM3D={showDOM3D}
          setShowDOM3D={setShowDOM3D}
        />
        <ControlPanel
          isOpen={isControlPanelOpen}
          onClose={() => setIsControlPanelOpen(false)}
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

          {showDOM3D && <Dom3DInfos />}

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
        <div className="place-self-start [align-self:end] flex *:-ml-px *:first:rounded-r-none *:last:rounded-l-none pointer-events-auto">
          <XRButton mode="immersive-vr" text="Enter" setXRMode={setXRMode} />
          <XRButton mode="immersive-ar" text="Enter" setXRMode={setXRMode} />
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
