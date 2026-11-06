import type { Entity } from "@3dverse/livelink";

import type { JointAxis } from "../joints/joints";

/** The tag marking the entities the HUD is drawn around. */
export const HOLO_TAG = "main";

/**
 * The shape of the shell drawn around a part, in the part's own frame. A cylinder's axis is one of
 * the part's local axes, and its diameter the larger of the part's two extents across it.
 */
export type HoloShape = { kind: "box" } | { kind: "cylinder"; axis: JointAxis };

const BOX: HoloShape = { kind: "box" };
const AXES: readonly string[] = ["x", "y", "z"];

/**
 * The shell an entity's tags ask for, or `null` when it carries no HUD tag:
 *
 * - `main` or `main:box` — a box;
 * - `main:cylinder:<x|y|z>` — a cylinder along that local axis (y when the axis is missing or not
 *   one of x, y, z).
 */
export function holoShapeOf(entity: Entity): HoloShape | null {
  for (const tag of entity.tags?.value ?? []) {
    const [name, kind, axis] = tag.trim().toLowerCase().split(":");
    if (name !== HOLO_TAG) {
      continue;
    }
    if (kind === "cylinder") {
      return {
        kind: "cylinder",
        axis: (AXES.includes(axis) ? axis : "y") as JointAxis,
      };
    }
    return BOX;
  }
  return null;
}
