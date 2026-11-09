import { useCallback, useEffect, useRef, useState } from "react";
import {
  useSceneSettings,
  type DefaultCameraController,
} from "@3dverse/livelink-react";

type SceneSettings = ReturnType<typeof useSceneSettings>["sceneSettings"];

const FALLBACK_POINT_OF_VIEW = {
  position: [0, 1, 5] as [number, number, number],
  orientation: [0, 0, 0, 1] as [number, number, number, number],
};

/** Where the viewer's camera starts: the scene's default camera transform. */
export function defaultPointOfView(
  settings: SceneSettings,
  isPending: boolean,
) {
  return (
    (!isPending && settings?.default_camera_transform) || FALLBACK_POINT_OF_VIEW
  );
}

/**
 * Travel back to the scene's default camera transform — shared by the "Reset position" button and
 * the `R` shortcut, so both do exactly the same thing (as `useViewerCommands` does in the mobile
 * viewer).
 *
 * `isAtDefaultPosition` lets the button dim itself as a no-op: the camera sits at the default
 * transform from mount until the user grabs it.
 *
 * The camera also starts there. The controller's orbital preset otherwise turns it, on creation,
 * to look at the world origin rather than along the default orientation, so the first view and the
 * reset one differed.
 */
export function useResetCamera(
  cameraController: DefaultCameraController | null,
) {
  const { sceneSettings, isPending } = useSceneSettings();
  const [isAtDefaultPosition, setIsAtDefaultPosition] = useState(true);

  useEffect(() => {
    if (!cameraController) {
      return;
    }
    const onUserTookControl = () => setIsAtDefaultPosition(false);
    cameraController.addEventListener("control", onUserTookControl);
    return () =>
      cameraController.removeEventListener("control", onUserTookControl);
  }, [cameraController]);

  // Once per controller, as soon as the scene's settings are known: no transition, it is the start.
  const startedController = useRef<DefaultCameraController | null>(null);
  useEffect(() => {
    if (
      !cameraController ||
      isPending ||
      startedController.current === cameraController
    ) {
      return;
    }
    startedController.current = cameraController;
    const { position, orientation } = defaultPointOfView(
      sceneSettings,
      isPending,
    );
    void cameraController.travelToPointOfView({
      position,
      orientation,
      enable_transition: false,
    });
  }, [cameraController, sceneSettings, isPending]);

  const resetCamera = useCallback(async () => {
    if (!cameraController) {
      return;
    }
    const { position, orientation } = defaultPointOfView(
      sceneSettings,
      isPending,
    );
    setIsAtDefaultPosition(true);
    await cameraController.travelToPointOfView({ position, orientation });
  }, [cameraController, sceneSettings, isPending]);

  return { resetCamera, isAtDefaultPosition };
}
