import type { Entity } from "@3dverse/livelink";
import { quat, vec3 } from "gl-matrix";

export type JointAxis = "x" | "y" | "z";

export type JointInfo = {
  label: string;
  axis: JointAxis;
};

//------------------------------------------------------------------------------
/**
 * What each pivot of the arm is called and which local axis it turns about, keyed by the `part_N`
 * entity names `PartEntitiesProvider` loads. Taken from the labels the old Dom3DInfos showed and
 * the axes `setOrientation` (movements.tsx) lets each joint rotate on.
 *
 * A part missing from here is still shown, as "Joint N", on whichever axis it is turned about the
 * most — see `dominantAxis`.
 */
export const JOINTS: Record<string, JointInfo> = {
  part_1: { label: "Base", axis: "z" },
  part_2: { label: "Shoulder", axis: "x" },
  part_3: { label: "Elbow 1", axis: "z" },
  part_4: { label: "Arm", axis: "y" },
  part_5: { label: "Elbow 2", axis: "z" },
  part_6: { label: "Elbow 3", axis: "x" },
  part_7: { label: "Positioner", axis: "y" },
  part_8: { label: "Turntable", axis: "y" },
};

const AXIS_INDEX: Record<JointAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

//------------------------------------------------------------------------------
/** Wrap an angle in degrees into (-180, 180]. */
const wrapDegrees = (deg: number) => {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
};

/**
 * The rotation of a local orientation about one of its parent's axes, in degrees — the "twist" of a
 * swing-twist decomposition. Read from the quaternion rather than from Euler angles, which flip
 * past ±90° on the middle axis of their order; for a joint that only ever turns about one axis it
 * is exactly that joint's angle.
 */
export function twistAngle(
  orientation: readonly number[],
  axis: JointAxis,
): number {
  const w = orientation[3] ?? 1;
  const component = orientation[AXIS_INDEX[axis]] ?? 0;
  return wrapDegrees((2 * Math.atan2(component, w) * 180) / Math.PI);
}

/** The axis a joint is turned about the most — the fallback for parts `JOINTS` does not list. */
export function dominantAxis(orientation: readonly number[]): JointAxis {
  const axes: JointAxis[] = ["x", "y", "z"];
  return axes.reduce(
    (best, axis) =>
      Math.abs(twistAngle(orientation, axis)) >
      Math.abs(twistAngle(orientation, best))
        ? axis
        : best,
    "z",
  );
}

/** The label and axis of a part entity, with the fallback for parts `JOINTS` does not list. */
export function jointInfoFor(entity: Entity): JointInfo {
  const name = entity.name ?? "";
  const known = JOINTS[name];
  if (known) {
    return known;
  }
  const number = name.split("_")[1];
  return {
    label: number ? `Joint ${number}` : name,
    axis: dominantAxis(entity.local_transform.orientation ?? [0, 0, 0, 1]),
  };
}

//------------------------------------------------------------------------------
// Laying a gauge in its joint's plane of rotation.
//------------------------------------------------------------------------------
const AXIS_VECTORS: Record<JointAxis, vec3> = {
  x: vec3.fromValues(1, 0, 0),
  y: vec3.fromValues(0, 1, 0),
  z: vec3.fromValues(0, 0, 1),
};

/**
 * Where 0° points, in the parent's frame: the next axis round, so that the gauge's "right"
 * (`axis × zero`) is the remaining positive axis — x → y → z → x.
 */
const ZERO_DIRECTION: Record<JointAxis, JointAxis> = { x: "y", y: "z", z: "x" };

// Scratch — this runs for every joint on every frame, so nothing here allocates.
const localInverse = quat.create();
const parentWorld = quat.create();
const worldToView = quat.create();
const ringRight = vec3.create();
const ringDown = vec3.create();

/** The 2D linear part of the gauge's CSS transform, `matrix(a, b, c, d, 0, 0)`. */
export type RingPlane = { a: number; b: number; c: number; d: number };

/**
 * How the joint's plane of rotation looks from the camera, as the linear map that takes the flat
 * gauge onto it: the circle becomes the ellipse a real disc around that axis would project to.
 *
 * The plane is the parent's, not the part's own: rotating about the joint's axis moves the part but
 * not the plane, and 0° has to stay put for the arc and needle to mean anything. The parent's
 * world orientation is recovered as `global × local⁻¹`, so the parent entity is never needed.
 *
 * Orthographic about the pivot — perspective foreshortening across a ring this size is negligible.
 * Seen from behind, the map is mirrored, which is what makes the arc run the way the part turns.
 *
 * @param cameraWorldOrientation The camera's world orientation; it looks down its -Z, Y up.
 */
export function ringPlaneInView(
  entity: Entity,
  axis: JointAxis,
  cameraWorldOrientation: readonly number[],
): RingPlane {
  const local = entity.local_transform?.orientation ?? [0, 0, 0, 1];
  const global = entity.global_transform?.orientation ?? [0, 0, 0, 1];

  quat.invert(localInverse, local as quat);
  quat.multiply(parentWorld, global as quat, localInverse);
  quat.invert(worldToView, cameraWorldOrientation as quat);
  // world → view, applied after parent → world.
  quat.multiply(worldToView, worldToView, parentWorld);

  // The gauge's +x (towards positive angles) and +y (down, away from 0°), in view space.
  const zero = AXIS_VECTORS[ZERO_DIRECTION[axis]];
  vec3.cross(ringRight, AXIS_VECTORS[axis], zero);
  vec3.transformQuat(ringRight, ringRight, worldToView);
  vec3.negate(ringDown, zero);
  vec3.transformQuat(ringDown, ringDown, worldToView);

  // View space has +y up and the screen +y down.
  return { a: ringRight[0], b: -ringRight[1], c: ringDown[0], d: -ringDown[1] };
}
