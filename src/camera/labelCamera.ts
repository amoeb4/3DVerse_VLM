/** Where a camera stands and how it is turned, in world space. */
export type PointOfView = {
  position: [number, number, number];
  orientation: [number, number, number, number];
};

/**
 * What `label.camera` holds before a camera is saved on the label: the scene origin, unrotated.
 */
const UNSET_LABEL_CAMERA = [0, 0, 0, 0, 0, 0, 1];

/**
 * The pose saved on a `label`, `[x, y, z, qx, qy, qz, qw]` in world space (as livelink-react's
 * `useLabelPointsOfView` reads it), or `null` when none was saved.
 */
export function labelCamera(
  camera: ArrayLike<number> | undefined,
): PointOfView | null {
  if (!camera || camera.length < 7) {
    return null;
  }
  const [x, y, z, qx, qy, qz, qw] = Array.from(camera);
  if (
    [x, y, z, qx, qy, qz, qw].every(
      (value, index) => value === UNSET_LABEL_CAMERA[index],
    )
  ) {
    return null;
  }
  return { position: [x, y, z], orientation: [qx, qy, qz, qw] };
}
