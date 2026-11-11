import { useEffect } from "react";
import { useEntity } from "@3dverse/livelink-react";
import type { Transform } from "@3dverse/livelink";
import { quat, vec3 } from "gl-matrix";

import { labelCamera } from "../camera/labelCamera";

/**
 * The name of the scene entity that says where an XR session starts.
 *
 * Give it a `label` component and save a camera on it (the editor's label camera): the viewer's
 * eyes start where that camera is, facing where it looks. The rig puts the eyes exactly on the
 * origin, so a camera pose is the right thing to store. Without a saved camera, the entity's own
 * transform is used instead: place it at eye height, its -Z axis the way to face.
 *
 * Either way only the heading is kept: a pose pitched or rolled would tilt the whole world.
 * Without such an entity in the scene, the session starts at the scene's origin, as before.
 */
export const XR_START_MARKER = "xr_start";

/**
 * The `originTransform` of `<WebXR>` from the scene's {@link XR_START_MARKER}, or `undefined` when
 * the scene has none (or it is still being looked up).
 *
 * Mount this before the session starts, not with it: `<WebXR>` reads `originTransform` once, when
 * the session starts, and that start has to follow the click on the XR button closely (an
 * immersive session needs the user's activation), with no lookup in between.
 */
export function useXRStartTransform():
  | {
      transform: Partial<Transform>;
      source: "label camera" | "entity transform";
    }
  | undefined {
  const { entity } = useEntity({ name: XR_START_MARKER });
  if (!entity) {
    return undefined;
  }

  const saved = labelCamera(entity.label?.camera);
  const { position, orientation } = saved ?? {
    position: entity.global_transform.position,
    orientation: entity.global_transform.orientation,
  };
  return {
    transform: {
      position: [position[0], position[1], position[2]],
      eulerOrientation: [0, headingDegrees(orientation), 0],
    },
    source: saved ? "label camera" : "entity transform",
  };
}

/**
 * The heading of `orientation` in degrees about +Y: where it turns the entity's forward axis (-Z),
 * flattened onto the floor.
 */
function headingDegrees(
  orientation: Readonly<[number, number, number, number]>,
): number {
  const forward = vec3.transformQuat(
    vec3.create(),
    [0, 0, -1],
    quat.fromValues(...orientation),
  );
  // A yaw of θ about +Y turns -Z into (-sin θ, 0, -cos θ).
  return (Math.atan2(-forward[0], -forward[2]) * 180) / Math.PI;
}

/**
 * Reports {@link useXRStartTransform} to a component above `<Livelink>`, whose hooks it cannot call
 * itself. Renders nothing; keep it mounted for as long as an XR session may be started.
 */
export function XRStartMarker({
  onChange,
}: {
  onChange: (transform: Partial<Transform> | undefined) => void;
}): null {
  const start = useXRStartTransform();
  // By value: the transform is a new object on every render.
  const key = start ? JSON.stringify(start) : "";
  useEffect(() => {
    const resolved = key
      ? (JSON.parse(key) as NonNullable<ReturnType<typeof useXRStartTransform>>)
      : undefined;
    // Where the next XR session starts, and from what: the eyes go exactly on this position.
    console.info(
      resolved
        ? `[xr] start from '${XR_START_MARKER}' (${resolved.source}):`
        : `[xr] no '${XR_START_MARKER}' entity: start at the scene origin`,
      resolved?.transform ?? "",
    );
    onChange(resolved?.transform);
  }, [key, onChange]);
  return null;
}
