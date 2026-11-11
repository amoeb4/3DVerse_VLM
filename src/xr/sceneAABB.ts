import type { Vec3 } from "@3dverse/livelink";
import { getSceneAABB as fetchSceneAABB } from "@3dverse/api";

import { PUBLIC_TOKEN } from "../config";

export type SceneAABB = {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  faceCenter: {
    top: Vec3;
    bottom: Vec3;
    left: Vec3;
    right: Vec3;
    front: Vec3;
    back: Vec3;
  };
  diagonalLength: number;
};

/** What a scene with no bounding box, or one that could not be read, is given. */
export const EMPTY_SCENE_AABB: SceneAABB = {
  min: [0, 0, 0],
  max: [0, 0, 0],
  center: [0, 0, 0],
  faceCenter: {
    top: [0, 0, 0],
    bottom: [0, 0, 0],
    left: [0, 0, 0],
    right: [0, 0, 0],
    front: [0, 0, 0],
    back: [0, 0, 0],
  },
  diagonalLength: 0,
};

// The same token the Livelink session is opened with; the API takes it as a user token.
const HEADERS = { user_token: PUBLIC_TOKEN } as unknown as Parameters<
  typeof fetchSceneAABB
>[1];

// Y is up, so `faceCenter.bottom` is the Y-minimum face — which is the one `applyAnchorReference`
// rests on a surface in AR. `diagonalLength` is 0 for a scene with no bounding box; callers that
// scale by it have to guard that.
export const getSceneAABB = async (scene_id: string): Promise<SceneAABB> => {
  const aabb = await fetchSceneAABB({ scene_id }, HEADERS);

  const { min, max } = aabb.data;
  const mid = (axis: number) => (max[axis] + min[axis]) / 2;
  const center = [mid(0), mid(1), mid(2)] as Vec3;
  const faceCenter = {
    top: [mid(0), max[1], mid(2)] as Vec3,
    bottom: [mid(0), min[1], mid(2)] as Vec3,
    left: [min[0], mid(1), mid(2)] as Vec3,
    right: [max[0], mid(1), mid(2)] as Vec3,
    front: [mid(0), mid(1), max[2]] as Vec3,
    back: [mid(0), mid(1), min[2]] as Vec3,
  };

  const diagonalLength = Math.sqrt(
    (max[0] - min[0]) ** 2 + (max[1] - min[1]) ** 2 + (max[2] - min[2]) ** 2,
  );

  return {
    min: min as Vec3,
    max: max as Vec3,
    center,
    faceCenter,
    diagonalLength,
  };
};
