import { useCallback, useEffect, useState } from "react";
import {
  useSceneSettings,
  type DefaultCameraController,
} from "@3dverse/livelink-react";

/**
 * Travel back to the scene's default camera transform — shared by the "Reset position" button and
 * the `R` shortcut, so both do exactly the same thing (as `useViewerCommands` does in the mobile
 * viewer).
 *
 * `isAtDefaultPosition` lets the button dim itself as a no-op: the camera sits at the default
 * transform from mount until the user grabs it.
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

  const resetCamera = useCallback(async () => {
    if (!cameraController) {
      return;
    }
    const { position, orientation } = (!isPending &&
      sceneSettings?.default_camera_transform) || {
      position: [0, 1, 5] as [number, number, number],
      orientation: [0, 0, 0, 1] as [number, number, number, number],
    };
    setIsAtDefaultPosition(true);
    await cameraController.travelToPointOfView({ position, orientation });
  }, [cameraController, sceneSettings, isPending]);

  return { resetCamera, isAtDefaultPosition };
}
