import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DOM3DEntityAnchor,
  DOM3DOverlay,
  ViewportContext,
} from "@3dverse/livelink-react";

import { PartEntitiesContext } from "../../partEntitiesContext";
import { JointGauge } from "./JointGauge";
import { jointInfoFor, ringPlaneInView, twistAngle } from "./joints";

/** Below this, a change is noise rather than a move worth a render. In degrees. */
const ANGLE_EPSILON = 0.05;

/** Distance scaling of the gauges, as `DOM3DEntityAnchor` takes it. */
const GAUGE_SCALE_FACTOR = 0.0012;

/**
 * A ring seen edge-on collapses to a line; it is kept faintly visible rather than vanishing, so the
 * pivot never loses its marker. Opacity runs from this, edge-on, to 1, face-on.
 */
const EDGE_ON_OPACITY = 0.35;

/**
 * A `JointGauge` on every pivot of the arm, showing its live angle, laid in the joint's plane of
 * rotation. Must be rendered inside a `Viewport`: `DOM3DOverlay` projects onto it, and the camera
 * the rings are oriented against is read from it.
 *
 * One loop, once per frame, does both halves of the work:
 * - the angles, which the WebSocket feed writes locally and at its own pace, go through React — and
 *   only when one has actually moved;
 * - the ring orientations, which change with every camera move, are written straight to the ring
 *   elements, so orbiting the camera never re-renders anything.
 */
export function JointAnglesOverlay() {
  const { entities } = useContext(PartEntitiesContext);
  const { camera } = useContext(ViewportContext);
  const joints = useMemo(
    () => entities.map((entity) => ({ entity, info: jointInfoFor(entity) })),
    [entities],
  );

  const [angles, setAngles] = useState<Record<string, number>>({});
  const ringElements = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (joints.length === 0) {
      return;
    }
    let frame = 0;
    let previous: Record<string, number> = {};

    const sample = () => {
      const next: Record<string, number> = {};
      let hasChanged = false;
      const cameraOrientation = camera?.world_orientation;

      for (const { entity, info } of joints) {
        const orientation = entity.local_transform?.orientation ?? [0, 0, 0, 1];
        const angle = twistAngle(orientation, info.axis);
        next[entity.id] = angle;
        if (
          previous[entity.id] === undefined ||
          Math.abs(previous[entity.id] - angle) > ANGLE_EPSILON
        ) {
          hasChanged = true;
        }

        const ring = ringElements.current.get(entity.id);
        if (ring && cameraOrientation) {
          const { a, b, c, d } = ringPlaneInView(
            entity,
            info.axis,
            cameraOrientation,
          );
          // |det| is how squarely the ring faces the camera: 1 face-on, 0 edge-on.
          const facing = Math.min(1, Math.abs(a * d - b * c));
          ring.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, 0, 0)`;
          ring.style.opacity = String(
            EDGE_ON_OPACITY + (1 - EDGE_ON_OPACITY) * facing,
          );
        }
      }

      if (hasChanged) {
        previous = next;
        setAngles(next);
      }
      frame = requestAnimationFrame(sample);
    };

    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, [joints, camera]);

  if (joints.length === 0) {
    return null;
  }

  return (
    <DOM3DOverlay>
      {joints.map(({ entity, info }) => (
        <DOM3DEntityAnchor
          key={entity.id}
          entity={entity}
          offset="center"
          scaleFactor={GAUGE_SCALE_FACTOR}
        >
          <JointGauge
            label={info.label}
            axis={info.axis}
            angle={angles[entity.id] ?? 0}
            ringRef={(element) => {
              if (element) {
                ringElements.current.set(entity.id, element);
              } else {
                ringElements.current.delete(entity.id);
              }
            }}
          />
        </DOM3DEntityAnchor>
      ))}
    </DOM3DOverlay>
  );
}
