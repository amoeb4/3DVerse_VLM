import { useEffect, useMemo } from "react";
import { useCameraEntity } from "@3dverse/livelink-react";

import { themeCameraSettings, useThemeStore } from "../hooks/useTheme";
import type { ViewSettings } from "../hooks/useViewSettings";
import { cameraRenderSettings } from "./renderSettings";

/**
 * This viewer's two cameras: the main one, and the one of the picture-in-picture views (Monitor's
 * alternate camera, Training's second viewpoint). The render graph's settings are kept on both;
 * some are in the View menu.
 */
export function useViewerCameras({
  atmosphere,
  outlines,
  grid,
}: Pick<ViewSettings, "atmosphere" | "outlines" | "grid">) {
  const { cameraEntity } = useCameraEntity();
  const { cameraEntity: pipCameraEntity } = useCameraEntity();

  const renderSettings = useMemo(
    () => cameraRenderSettings({ atmosphere, outlines, grid }),
    [atmosphere, outlines, grid],
  );

  // The background of this viewer's theme: theirs alone, as the cameras are.
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    for (const camera of [cameraEntity, pipCameraEntity]) {
      if (camera?.camera) {
        camera.camera.dataJSON = {
          ...camera.camera.dataJSON,
          ...renderSettings,
          ...themeCameraSettings(theme),
        };
      }
    }
  }, [cameraEntity, pipCameraEntity, renderSettings, theme]);

  return { cameraEntity, pipCameraEntity };
}
