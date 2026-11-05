import { useCallback, useEffect, useState } from "react";
import { useSceneSettings, type DefaultCameraController } from "@3dverse/livelink-react";
import { Button, Icon, cn } from "@3dverse/ui-lib";

// Same behavior as the mobile viewer's "Reset position": travel back to the scene's default camera
// transform, and dim the button while the camera is already there.
export function ResetPositionButton({
  cameraController,
}: {
  cameraController: DefaultCameraController | null;
}) {
  const { sceneSettings, isPending } = useSceneSettings();
  const [isAtDefaultPosition, setIsAtDefaultPosition] = useState(true);

  // The camera sits at the default transform from mount until the user grabs it.
  useEffect(() => {
    if (!cameraController) {
      return;
    }
    const onUserTookControl = () => setIsAtDefaultPosition(false);
    cameraController.addEventListener("control", onUserTookControl);
    return () => cameraController.removeEventListener("control", onUserTookControl);
  }, [cameraController]);

  const resetPosition = useCallback(async () => {
    if (!cameraController) {
      return;
    }
    const { position, orientation } = (!isPending && sceneSettings?.default_camera_transform) || {
      position: [0, 1, 5] as [number, number, number],
      orientation: [0, 0, 0, 1] as [number, number, number, number],
    };
    setIsAtDefaultPosition(true);
    await cameraController.travelToPointOfView({ position, orientation });
  }, [cameraController, sceneSettings, isPending]);

  return (
    <Button
      variant="overlay-outline"
      className={cn(
        "px-4 py-2 before:opacity-100 before:backdrop-blur-xl",
        isAtDefaultPosition && "text-primary/50",
      )}
      round
      title="Reset position"
      onClick={resetPosition}
      disabled={!cameraController}
    >
      Reset position
    </Button>
  );
}
