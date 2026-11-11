import { useEffect, useState } from "react";
import { Livelink } from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import type { Transform } from "@3dverse/livelink";

import { HeadsetGate } from "../components/HeadsetGate";
import { SpeedProvider } from "../components/TrainingPanel";
import { MACHINES, PUBLIC_TOKEN } from "../config";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import KeyboardHandler from "../keyBindings";
import { PartEntitiesProvider } from "../partEntitiesContext";
import type { ViewerScene } from "../routing";
import { isHeadset } from "../utils/isHeadset";
import { WebSocketProvider } from "../webSockets";
import { useWebXRStore } from "../xr/stores";
import { XRSupport } from "../xr/useXRSupport";
import { XRHud } from "../xr/XRHud";
import { XRSession } from "../xr/XRSession";
import { XRStartMarker } from "../xr/xrStartMarker";
import { useReconnect } from "./useReconnect";
import { ViewerLayout } from "./ViewerLayout";

/**
 * A machine's viewer: the connection to its session (`Livelink`), what the whole viewer shares
 * under it, and the layout (`ViewerLayout`), flat or inside an XR session.
 */
export function Viewer({
  scene,
  sessionId,
}: {
  scene: ViewerScene;
  sessionId?: string;
}) {
  // --- Stores ---------------------------------------------------------------------------------
  // The XR session, as 3dverse-mobile-viewer runs it (`xr/`): the mode is set optimistically by
  // whoever asks for XR (`useEnterXR`), and the flat view is swapped for `<WebXR>` (`XRSession`)
  // on the strength of it. In the store, not here: the session's own objects read it too.
  const xrMode = useWebXRStore((state) => state.xrMode);
  const setXRMode = useWebXRStore((state) => state.setXrMode);

  // --- Local state ----------------------------------------------------------------------------
  // Where an XR session starts, from the scene's `xr_start` entity (`xrStartMarker.ts`).
  const [xrOrigin, setXROrigin] = useState<Partial<Transform>>();
  const { connectionAttempt, ConnectionErrorPanel } = useReconnect();

  // --- Derived --------------------------------------------------------------------------------
  const buildPlate = MACHINES.find(
    (machine) => machine.sceneId === scene.sceneId,
  )?.buildPlate;

  // --- Effects --------------------------------------------------------------------------------
  // Leaving the viewer leaves XR: the store outlives it.
  useEffect(() => () => setXRMode(null), [setXRMode]);
  useDocumentTitle(`${scene.name} · VLM Vision`);
  // The viewer fills the screen and never scrolls. Home, which does scroll, gets the body as it
  // was.
  useLockBodyScroll();

  // The same layout in both views. Swapping one for the other mounts it afresh: it is not at the
  // same place in the tree.
  const layout = (
    <ViewerLayout
      isXR={Boolean(xrMode)}
      machineName={scene.name}
      sceneId={scene.sceneId}
      buildPlate={buildPlate}
    />
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
      <PartEntitiesProvider>
        <SpeedProvider>
          <WebSocketProvider>
            <KeyboardHandler />
            <XRStartMarker onChange={setXROrigin} />
            {/* Which immersive modes this device can enter, and the `?xr=` deep link. */}
            <XRSupport />

            {xrMode ? (
              /* --- MODE CASQUE / IMMERSIF ACTIF --- */
              <XRSession mode={xrMode} originTransform={xrOrigin}>
                {layout}
              </XRSession>
            ) : (
              /* --- MODE NORMAL (Navigateur Classique) --- */
              layout
            )}

            {/* The XR session's own controls: beside the swap above, so they survive it. */}
            <XRHud />
            {/* In a headset's browser: the way into AR first, over the page. */}
            {isHeadset && <HeadsetGate machineName={scene.name} />}
          </WebSocketProvider>
        </SpeedProvider>
      </PartEntitiesProvider>
    </Livelink>
  );
}
