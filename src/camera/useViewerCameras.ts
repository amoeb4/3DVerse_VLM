import { useEffect, useMemo } from "react";
import { useCameraEntity } from "@3dverse/livelink-react";

import type { ViewSettings } from "../hooks/useViewSettings";
import { cameraRenderSettings } from "./renderSettings";

/**
 * This viewer's two cameras: the main one, and the one of the picture-in-picture views (Monitor's
 * alternate camera, Training's second viewpoint). The render graph's settings are kept on both;
 * some are in the View menu.
 */
export function useViewerCameras({
  outlines,
  grid,
}: Pick<ViewSettings, "outlines" | "grid">) {
  const { cameraEntity } = useCameraEntity();
  const { cameraEntity: pipCameraEntity } = useCameraEntity();

  const renderSettings = useMemo(
    () => cameraRenderSettings({ outlines, grid }),
    [outlines, grid],
  );

  useEffect(() => {
    for (const camera of [cameraEntity, pipCameraEntity]) {
      if (camera?.camera) {
        camera.camera.dataJSON = {
          ...camera.camera.dataJSON,
          ...renderSettings,
        };
      }
    }
  }, [cameraEntity, pipCameraEntity, renderSettings]);

  return { cameraEntity, pipCameraEntity };
}
