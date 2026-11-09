import { useCallback, useContext, useEffect, useState } from "react";
import {
  CameraController,
  Canvas,
  Livelink,
  LivelinkContext,
  Viewport,
  useCameraEntity,
  useSceneSettings,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Viewport as LivelinkViewport } from "@3dverse/livelink";

import { PUBLIC_TOKEN } from "../../config";
import { cameraRenderSettings } from "../../camera/renderSettings";
import { DEFAULT_VIEW_SETTINGS } from "../../hooks/useViewSettings";
import { defaultPointOfView } from "../../hooks/useResetCamera";

/**
 * Where a tile's preview stands. `ready` once the scene is on its canvas, `offline` when the
 * session could not be opened or dropped: the tile then keeps its picture.
 */
export type PreviewStatus = "loading" | "ready" | "offline";

/** The camera swings this far either side of the scene's default view, in radians… */
const SWAY_AMPLITUDE = 0.3;
/** …over this long a round trip. */
const SWAY_PERIOD_S = 18;
/** For the server's answers that have no timeout of their own: scene loaded, picking. */
const SERVER_DEADLINE_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const withDeadline = <T,>(promise: Promise<T>) =>
  Promise.race([promise, sleep(SERVER_DEADLINE_MS).then(() => null)]);

//------------------------------------------------------------------------------
/**
 * A machine's scene, live, for its tile on the startup page: rendered by 3dverse from the scene's
 * default view (the viewer's first one), the camera swaying slowly around what that view looks at.
 * No input: the tile stays a link.
 *
 * Each preview is a session of its own, apart from the ones people work in: a transient one, which
 * the viewer never joins (it opens persistent sessions only) and the LIVE badges leave out
 * (`useLiveSessions`). The gallery's visitors share it, though: `autoJoinExisting` joins the
 * transient session already running on the scene, if any, rather than starting one more.
 *
 * Unmounting it disconnects from the session.
 */
export function MachinePreview({
  sceneId,
  onStatus,
  className,
}: {
  sceneId: string;
  /** Must be stable (a state setter): it is a dependency of the preview's effects. */
  onStatus: (status: PreviewStatus) => void;
  className?: string;
}) {
  // Mounted again, it starts over: no frame on the canvas yet.
  useEffect(() => () => onStatus("loading"), [onStatus]);

  return (
    <div className={className} aria-hidden="true">
      <Livelink
        sceneId={sceneId}
        isTransient
        autoJoinExisting
        token={PUBLIC_TOKEN}
      >
        <PreviewView onStatus={onStatus} />
      </Livelink>
    </div>
  );
}

//------------------------------------------------------------------------------
function PreviewView({
  onStatus,
}: {
  onStatus: (status: PreviewStatus) => void;
}) {
  const { instance, isConnecting, isDisconnected } =
    useContext(LivelinkContext);
  const { sceneSettings, isPending } = useSceneSettings();
  const { cameraEntity } = useCameraEntity();

  // State rather than refs: the effects below wait for them.
  const [viewport, setViewport] = useState<LivelinkViewport | null>(null);
  const viewportRef = useCallback(
    (next: LivelinkViewport | undefined | null) => setViewport(next ?? null),
    [],
  );
  const [controller, setController] = useState<DefaultCameraController | null>(
    null,
  );
  const controllerRef = useCallback(
    (next: DefaultCameraController | undefined | null) =>
      setController(next ?? null),
    [],
  );
  // The camera is at the scene's default view.
  const [framed, setFramed] = useState(false);
  // The scene is on the canvas, and the camera turns around what it looks at.
  const [ready, setReady] = useState(false);

  // The viewer's look, as it opens.
  useEffect(() => {
    if (cameraEntity?.camera) {
      cameraEntity.camera.dataJSON = {
        ...cameraEntity.camera.dataJSON,
        ...cameraRenderSettings(DEFAULT_VIEW_SETTINGS),
      };
    }
  }, [cameraEntity]);

  // The scene's default view, as in the viewer (`useResetCamera`).
  useEffect(() => {
    if (!controller || isPending) {
      return;
    }
    let cancelled = false;
    const { position, orientation } = defaultPointOfView(
      sceneSettings,
      isPending,
    );
    void controller
      .travelToPointOfView({ position, orientation, enable_transition: false })
      .then(() => {
        if (!cancelled) {
          setFramed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [controller, sceneSettings, isPending]);

  // Ready once the canvas has a picture of the whole scene: a first frame (`frame_dt` stays 0
  // until one arrives), and the scenes it references streamed in. Then the camera's target goes
  // to what is at the centre of the view, so the sway turns around the machine whatever the size
  // of the scene; without anything there, it stays where the default view puts it.
  useEffect(() => {
    if (isDisconnected) {
      setReady(false);
      onStatus("offline");
      return;
    }
    if (!instance || !viewport || !controller || isConnecting || !framed) {
      onStatus("loading");
      return;
    }
    let cancelled = false;
    void (async () => {
      while (!cancelled && instance.frame_dt === 0) {
        await sleep(100);
      }
      await withDeadline(instance.scene.waitForSceneLoaded());
      const hit = cancelled
        ? null
        : await withDeadline(
            viewport.castScreenSpaceRay({
              screen_position: [0.5, 0.5],
              mode: "None",
            }),
          );
      if (cancelled) {
        return;
      }
      if (hit) {
        controller.setOrbitPoint(...hit.world_position);
      }
      setReady(true);
      onStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [
    instance,
    viewport,
    controller,
    isConnecting,
    isDisconnected,
    framed,
    onStatus,
  ]);

  // The sway: a slow swing either side of the default view, from the moment the tile shows it.
  // Still for those who asked for less motion.
  useEffect(() => {
    if (
      !controller ||
      !ready ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let frame = 0;
    let start: number | null = null;
    let swung = 0;
    const sway = (now: number) => {
      start ??= now;
      const angle =
        SWAY_AMPLITUDE *
        Math.sin((((now - start) / 1000) * 2 * Math.PI) / SWAY_PERIOD_S);
      void controller.rotate(angle - swung, 0, false);
      swung = angle;
      frame = requestAnimationFrame(sway);
    };
    frame = requestAnimationFrame(sway);
    return () => cancelAnimationFrame(frame);
  }, [controller, ready]);

  return (
    <Canvas className="size-full">
      <Viewport
        ref={viewportRef}
        cameraEntity={cameraEntity}
        className="size-full"
      >
        <CameraController ref={controllerRef} />
      </Viewport>
    </Canvas>
  );
}
