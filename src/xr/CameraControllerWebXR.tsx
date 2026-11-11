import { useContext, useEffect, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import { WebXRContext } from "@3dverse/livelink-webxr";

import { EMPTY_SCENE_AABB, getSceneAABB, type SceneAABB } from "./sceneAABB";
import { useWebXRStore } from "./stores";
import { WebXRUtils } from "./WebXRUtils";

/**
 * The XR counterpart of the flat view's camera controller, from 3dverse-mobile-viewer: it builds
 * no controller of its own, but fetches the scene's bounding box, constructs the session's
 * `WebXRUtils` from it and publishes that to the store.
 *
 * Render it inside `<WebXR>`, whose context it reads. Renders nothing.
 */
export function CameraControllerWebXR(): null {
  const { instance } = useContext(LivelinkContext);
  const { xrLivelink } = useContext(WebXRContext);
  const setWebXRUtils = useWebXRStore((state) => state.setWebXRUtils);
  const [sceneAABB, setSceneAABB] = useState<SceneAABB | null>(null);

  const sceneId = instance?.session.scene_id;
  useEffect(() => {
    if (!sceneId) {
      return;
    }
    let cancelled = false;
    getSceneAABB(sceneId)
      // Without it the session still runs: "Fit 1m³" then does nothing, and placing rests the
      // scene's origin on the surface in place of its bounding box's bottom.
      .catch((error) => {
        console.error("Could not read the scene's bounding box", error);
        return EMPTY_SCENE_AABB;
      })
      .then((aabb) => {
        if (!cancelled) {
          setSceneAABB(aabb);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  useEffect(() => {
    if (!instance || !xrLivelink || !sceneAABB) {
      return;
    }

    console.debug("WebXRUtils creation...");
    const utils = new WebXRUtils(instance, xrLivelink, sceneAABB);
    utils
      .init()
      .then(() => {
        console.debug("WebXRUtils created!");
        setWebXRUtils(utils);
      })
      // Without this a rejection anywhere in that chain is an unhandled promise rejection that
      // skips `setWebXRUtils` — the HUD never appears and no control responds, with nothing said
      // about why.
      .catch((error) =>
        console.error("WebXRUtils initialization failed", error),
      );

    return () => {
      utils.release();
      setWebXRUtils(null);
    };
  }, [instance, xrLivelink, sceneAABB, setWebXRUtils]);

  return null;
}
