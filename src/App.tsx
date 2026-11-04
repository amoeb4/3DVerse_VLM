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
import KeyboardHandler from "./keyBindings.tsx";
import CameraEventListener from "./CameraEventListener.jsx";
import ControlPanel, { SpeedProvider, EntityProvider } from "./Interface.jsx";
import { CameraEntityContext } from "./cameraControl.tsx";
import { WebSocketProvider } from "./webSockets.tsx";
import { PartEntitiesProvider } from "./partEntitiesContext.tsx";
import Dtext from "../frontend/text_display.tsx";
import { Avatars } from "./Avatars.tsx";
import Dom3DInfos from "./DOM3Dinfos.tsx";
import "./App.css";
import { EntityCreator, createEntity } from "./weldBead.tsx";
import { EntityStatusPanel, EntityPanel } from "./EntityPicking.tsx";
import { DisplayDashboard } from "./Dashboard.tsx";
import { XRButton } from "./webXR.tsx";
import type { Entity } from "@3dverse/livelink";

export function App() {
  const [credentials, setCredentials] = useState<{ sceneId: string } | null>(null);
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
          LoadingPanel={LoadingOverlay}>
          <EntityProvider>
            <PartEntitiesProvider>
              <SpeedProvider>
                <WebSocketProvider>
                  <KeyboardHandler />
                  
                  {xrMode ? (
                    /* --- MODE CASQUE / IMMERSIF ACTIF --- */
                    <WebXR mode={xrMode} onSessionEnd={() => setXRMode(null)}>
                      <AppLayout />
                      <div className="fixed top-4 left-4 flex items-center justify-center gap-4 z-[99999]">
                        <button
                          className="button button-danger"
                          onClick={() => setXRMode(null)}>
                          Exit XR
                        </button>

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
                      <AppLayout />
                      
                      {/* Interface d'entrée WebXR fixe sur l'écran classique */}
                      <div className="fixed bottom-6 right-6 flex gap-4 z-[99999] bg-slate-900/80 p-3 rounded-xl backdrop-blur-sm">
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


function StartupModal({ onSubmit }: { onSubmit: (cred: { sceneId: string }) => void }) {
  const [sceneId, setSceneId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ sceneId });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white/80 backdrop-blur-md text-gray-800 rounded-2xl shadow-2xl p-10 max-w-md w-full border border-gray-200">
        <Dtext />

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 w-full max-w-2xl">
          <label className="block flex flex-col">
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
              required
            />
          </label>

          <div className="space-y-2">
            {[
              ["NJ130 2.05", "759ed8c4-fb60-432c-a41e-cf0f39f92d6f"],
              ["NJ40", "a1d7bb38-1a12-46fb-8485-36b29460cd2c"],
              ["Comau racer 3", "516d270a-5a6b-44e6-99c6-44df631bf475"],
              ["Test_primitive [deprecated]", "ec33e19d-da9f-4593-8412-a9c0c32cc5ba"],
            ].map(([label, id]) => (
              <div className="flex justify-center" key={id}>
                <button
                  type="button"
                  onClick={() => setSceneId(id)}
                  className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 px-5 py-2 rounded-md transition">
                  Load {label}
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              className="bg-yellow-600 hover:bg-yellow-600 text-white px-6 py-2 rounded-md font-semibold transition">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppLayout() {
  const { cameraEntity } = useCameraEntity();
  const { cameraEntity: pipCamera } = useCameraEntity();
  const { isConnecting } = useContext(LivelinkContext);
  const cameraControllerRef = useRef<DefaultCameraController>(null);
  const [showPipCamera, setShowPipCamera] = useState(false);
  const [showDOM3D, setShowDOM3D] = useState(true);

  const { instance } = useContext(LivelinkContext);

  const [pickedEntity, setPickedEntity] = useState<{ entity: Entity } | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<{ entity: Entity } | null>(null);

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

  return (
    <CameraEntityContext.Provider value={cameraEntity}>
      <EntityProvider>
        <ControlPanel />
        <DisplayDashboard />
      </EntityProvider>

      <CameraEventListener />

      <div className="absolute bottom-[5%] right-[1.15%] z-50">
        <button
          className="p-3 rounded-xl backdrop-blur bg-white/10 border border-white/20 shadow-xl text-white w-[120px] text-sm"
          onClick={() => setShowPipCamera((prev) => !prev)}>
          {showPipCamera ? "Minimize" : "Alt. Camera"}
        </button>
      </div>

      <div className="absolute bottom-[3%] left-[3%] z-50">
        <button
          className="p-3 rounded-xl backdrop-blur bg-white/10 border border-white/20 shadow-xl text-white w-[120px] text-sm"
          onClick={() => setShowDOM3D((prev) => !prev)}>
          {showDOM3D ? "Hide infos" : "Show infos"}
        </button>
      </div>

      <Canvas className="w-full h-screen">
        <Viewport
          cameraEntity={cameraEntity}
          className="w-full h-full"
          setHoveredEntity={setHoveredEntity}
          setPickedEntity={setPickedEntity}>
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
            <div className="absolute bottom-10 right-4 w-1/4 aspect-video border border-tertiary rounded-xl shadow-xl">
              <Viewport cameraEntity={pipCamera} className="w-full h-full">
                <CameraController />
              </Viewport>
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