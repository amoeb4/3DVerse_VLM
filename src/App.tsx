//------------------------------------------------------------------------------
import { useState, useContext, useRef, useEffect } from "react";
//------------------------------------------------------------------------------
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
import KeyboardHandler from "./keyBindings.tsx";
import CameraEventListener from "./CameraEventListener.jsx";
import ControlPanel, { SpeedProvider, EntityProvider } from "./Interface.jsx";
import { CameraEntityContext } from "./cameraControl.tsx";
import { WebSocketProvider } from "./webSockets.tsx";
import { PartEntitiesProvider } from "./partEntitiesContext.tsx";
import Dtext from "../frontend/text_display.tsx";
import { Avatars } from "./Avatars.tsx";
import Dom3DInfos from "./DOM3Dinfos.tsx";
import { EntityCreator, createEntity } from "./weldBead.tsx";
import { EntityStatusPanel, EntityPanel } from "./EntityPicking.tsx";
import { DisplayDashboard } from "./Dashboard.tsx";
import { XRButton } from "./webXR.tsx";
import type { Entity } from "@3dverse/livelink";
import { Toolbar } from "./widgets/Toolbar.tsx";

const MACHINES = [
  { name: "NJ130 2.05", sceneId: "759ed8c4-fb60-432c-a41e-cf0f39f92d6f" },
  { name: "NJ40", sceneId: "a1d7bb38-1a12-46fb-8485-36b29460cd2c" },
  { name: "Comau racer 3", sceneId: "516d270a-5a6b-44e6-99c6-44df631bf475" },
  {
    name: "Test_primitive [deprecated]",
    sceneId: "ec33e19d-da9f-4593-8412-a9c0c32cc5ba",
  },
];

type SceneSelection = { sceneId: string; name: string };

export function App() {
  const [credentials, setCredentials] = useState<SceneSelection | null>(null);
  const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);

  return (
    <>
      {!credentials ? (
        <StartupModal onSubmit={setCredentials} />
      ) : (
        <Livelink
          isTransient={false}
          sceneId={credentials.sceneId}
          token="public_ml59vXKlgs9fTJlx"
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
                      <AppLayout machineName={credentials.name} />
                      <div className="fixed top-4 left-4 flex items-center justify-center gap-4 z-99999">
                        <Button variant="overlay-outline" className="before:opacity-100 before:backdrop-blur-xl" onClick={() => setXRMode(null)}>Exit XR</Button>

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
                    <>
                      <AppLayout machineName={credentials.name} />
                      
                      {/* Interface d'entrée WebXR fixe sur l'écran classique */}
                      <div className="absolute bottom-4 left-4 flex *:first:rounded-r-none *:last:rounded-l-none z-99999 pointer-events-auto">
                        <XRButton
                          mode="immersive-vr"
                          text="Enter"
                          setXRMode={setXRMode}
                        />
                        <XRButton
                          mode="immersive-ar"
                          text="Enter"
                          setXRMode={setXRMode}
                        />
                      </div>
                    </>
                  )}
                </WebSocketProvider>
              </SpeedProvider>
            </PartEntitiesProvider>
          </EntityProvider>
        </Livelink>
      )}
    </>
  );
}

function StartupModal({
  onSubmit,
}: {
  onSubmit: (selection: SceneSelection) => void;
}) {
  const [customSceneId, setCustomSceneId] = useState("");

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="w-full max-w-md mx-2 px-4 md:px-10 py-4 md:py-6 border border-tertiary bg-ground rounded-3xl [corner-shape:squircle]">
        <Dtext />

        <nav className="flex flex-col mt-6 *:rounded-none *:first:rounded-t-xl! *:last:rounded-b-xl!">
          {MACHINES.map(({ name, sceneId }) => (
            <Button
              key={sceneId}
              variant="outline"
              size="lg"
              className="group w-full justify-between -mt-px py-2 border-secondary hover:border-accent/40 hover:text-accent hover:z-1 transition-all duration-500"
              onClick={() => onSubmit({ sceneId, name })}
            >
              {name}
              <Icon className="fas fa-angle-right text-3xs opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
            </Button>
          ))}
        </nav>

        <form
          onSubmit={(e) => {
            e.preventDefault(); // keep the browser from reloading the page
            onSubmit({ sceneId: customSceneId, name: "Custom scene" });
          }}
          className="mt-6 w-full max-w-2xl border-t border-tertiary pt-6"
        >
          <div className="relative flex">
            <input
              type="text"
              name="customSceneId"
              className="w-full px-3 py-1 border border-secondary bg-ground text-xs text-tertiary rounded-xl [corner-shape:squircle] focus:outline-hidden focus:ring-2 focus:ring-accent"
              value={customSceneId}
              placeholder="Custom scene "
              onChange={(e) => setCustomSceneId(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant={customSceneId ? "accent" : "ghost"}
              size="icon-sm"
              className={cn(
                "absolute right-0 top-0 h-full px-4 rounded-l-none",
                customSceneId ? "text-white!" : "",
              )}
            >
              <Icon className="fas fa-angle-right text-3xs" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppLayout({ machineName }: { machineName: string }) {
  const { cameraEntity } = useCameraEntity();
  const { cameraEntity: pipCamera } = useCameraEntity();
  const { isConnecting } = useContext(LivelinkContext);
  const cameraControllerRef = useRef<DefaultCameraController>(null);
  const [showPipCamera, setShowPipCamera] = useState(true);
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

  return (
    <CameraEntityContext.Provider value={cameraEntity}>
      <EntityProvider>
        <header className="absolute top-4 left-7 z-50">
          <h1 className="text-xl font-bold">{machineName}</h1>
        </header>
        <Toolbar
          onOpenControlPanel={() => setIsControlPanelOpen(true)}
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

      <div className="absolute bottom-4 right-4 z-50">
        <Button
          variant="overlay-outline"
          className="before:opacity-100 before:backdrop-blur-xl"
          onClick={() => setShowPipCamera((prev) => !prev)}
        >
          Alt. Camera
          <Icon className="fas fa-video text-2xs" />
        </Button>
      </div>

      <Canvas className="w-full h-screen">
        <Viewport
          cameraEntity={cameraEntity}
          className="w-full h-full"
          setHoveredEntity={setHoveredEntity}
          setPickedEntity={setPickedEntity}
        >
          {!isConnecting && (
            <a
              href="https://docs.3dverse.com/livelink.react/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden"
            />
          )}

          <CameraController ref={cameraControllerRef} />

          <Avatars />

          {showDOM3D && <Dom3DInfos />}

          {showPipCamera && (
            <div className="absolute bottom-3 right-3 w-1/4 aspect-video border border-tertiary shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
              <Viewport cameraEntity={pipCamera} className="w-full h-full">
                <CameraController />
              </Viewport>
              <Button
                variant="overlay"
                size="icon-xs"
                className="absolute top-1 left-1"
                onClick={() => setShowPipCamera(false)}
              >
                <Icon className="fas fa-angles-down -rotate-45" />
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
    </CameraEntityContext.Provider>
  );
}

export default App;
