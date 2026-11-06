import { createContext, useContext } from "react";
import type { Entity } from "@3dverse/livelink";

export const CameraEntityContext = createContext<Entity | null>(null);
export const useSharedCameraEntity = () => useContext(CameraEntityContext);
