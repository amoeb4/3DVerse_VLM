import type { PartGeometry, Point3 } from "./partGeometry";
import data from "./waamPart.json";

/**
 * The real part, from the robot programs PB_1.mpf, PB_2.mpf and PH_3.mpf (laid in that order).
 * Only the deposition moves (between ARC_ON and ARC_OFF) are kept; approaches and retreats are not.
 *
 * Machine frame (G54: X, Y, Z up) → part space (millimetres, Y up): [x, y, z] = [X, Z − 20, −Y].
 * 20 is the height of PB_1's first layer, so the part stands on y = 0. X and Y are left as they
 * are: the plate is centred on the origin, as the placeholder is.
 *
 * Paths were simplified (0.05 mm tolerance); points are not evenly spaced, which `PartModel` does
 * not need (it goes by arc length).
 */
const LAYERS = data.layers as unknown as readonly (readonly Point3[])[];

/** For each entry of `layers`: the program it comes from, its `Layer=` number there, its pass (0, 1). */
export const WAAM_LAYER_INFO = data.info as readonly (readonly [string, number, number])[];

/** The CAM's width and height for a bead, 1.2 × 2.45 mm; drawn wider so layers merge. */
const BEAD_RADIUS = 1.6;

export function waamPart(): PartGeometry {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const path of LAYERS) {
    for (const p of path) {
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i], p[i]);
        max[i] = Math.max(max[i], p[i]);
      }
    }
  }
  return {
    name: "PB_1 + PB_2 + PH_3",
    layers: LAYERS,
    // Some layers are rings, others open arcs: each path is drawn as it comes (a ring's last
    // point is its first).
    closed: false,
    beadRadius: BEAD_RADIUS,
    center: [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ] as Point3,
    size: Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
  };
}
