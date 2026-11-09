/**
 * The part being built, as the Part mode draws it: the torch's path for each layer. WAAM builds the
 * part alone, bead on bead; it does not join two parts. A layer's samples (`LayerRecord`) lie
 * evenly along its path, so any path works: the client's real geometry, once given, replaces the
 * placeholder by providing its layer paths (from the robot program or the CAM).
 *
 * Millimetres, Y up, the part standing on the build plate at y = 0.
 */

export type Point3 = readonly [number, number, number];

export type PartGeometry = {
  name: string;
  /** One path per layer, in the order they are laid; each a closed loop unless `closed` is false. */
  layers: readonly (readonly Point3[])[];
  closed: boolean;
  /** Half the bead's width. */
  beadRadius: number;
  /** Where to look from at first: the part's centre and its size. */
  center: Point3;
  size: number;
};

type ProfilePoint = { r: number; y: number };

function cubic(
  p0: ProfilePoint,
  p1: ProfilePoint,
  p2: ProfilePoint,
  p3: ProfilePoint,
  t: number,
): ProfilePoint {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    r: a * p0.r + b * p1.r + c * p2.r + d * p3.r,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/**
 * A deep plate's section, from the middle of its bottom out: the flat bottom, the well curving up,
 * then the rim opening out. Densely sampled; `ringsAlong` spaces the layers on it.
 */
function deepPlateProfile(): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  // The bottom, laid as concentric rings from a small centre out.
  for (let r = 4; r < 44; r += 0.5) {
    points.push({ r, y: 0 });
  }
  // The well.
  for (let i = 0; i <= 120; i += 1) {
    points.push(
      cubic(
        { r: 44, y: 0 },
        { r: 64, y: 0 },
        { r: 72, y: 27 },
        { r: 84, y: 38 },
        i / 120,
      ),
    );
  }
  // The rim.
  for (let i = 1; i <= 80; i += 1) {
    points.push(
      cubic(
        { r: 84, y: 38 },
        { r: 90, y: 43.5 },
        { r: 102, y: 44.5 },
        { r: 120, y: 46 },
        i / 80,
      ),
    );
  }
  return points;
}

/** `count` points evenly spaced along a polyline, by length. */
function ringsAlong(profile: ProfilePoint[], count: number): ProfilePoint[] {
  const lengths = [0];
  for (let i = 1; i < profile.length; i += 1) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          profile[i].r - profile[i - 1].r,
          profile[i].y - profile[i - 1].y,
        ),
    );
  }
  const total = lengths[lengths.length - 1];
  const rings: ProfilePoint[] = [];
  let segment = 1;
  for (let k = 0; k < count; k += 1) {
    const at = (k / (count - 1)) * total;
    while (segment < lengths.length - 1 && lengths[segment] < at) {
      segment += 1;
    }
    const span = lengths[segment] - lengths[segment - 1] || 1;
    const t = Math.min(1, Math.max(0, (at - lengths[segment - 1]) / span));
    const a = profile[segment - 1];
    const b = profile[segment];
    rings.push({ r: a.r + (b.r - a.r) * t, y: a.y + (b.y - a.y) * t });
  }
  return rings;
}

/** A horizontal ring as a path, starting on +X and turning anticlockwise seen from above. */
function ringPath({ r, y }: ProfilePoint): Point3[] {
  // About one point per 2 mm, so small rings stay light and large ones round.
  const points = Math.max(24, Math.min(240, Math.round((2 * Math.PI * r) / 2)));
  const path: Point3[] = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    path.push([r * Math.cos(angle), y, -r * Math.sin(angle)]);
  }
  return path;
}

/**
 * How much larger than its profile the placeholder is drawn: 3×, 720 mm across and 138 mm deep, to
 * read well in the cell. It overhangs NJ130's 298 × 275 mm build plate.
 */
const PLACEHOLDER_SCALE = 3;

/**
 * The placeholder until the client gives the part's geometry: a deep plate, in `layerCount` rings.
 * The bottom is laid first, ring by ring outwards, then the well and the rim, each layer a ring on
 * the last.
 */
export function deepPlate(layerCount: number): PartGeometry {
  const rings = ringsAlong(deepPlateProfile(), layerCount).map(({ r, y }) => ({
    r: r * PLACEHOLDER_SCALE,
    y: y * PLACEHOLDER_SCALE,
  }));
  const spacing = Math.hypot(rings[1].r - rings[0].r, rings[1].y - rings[0].y);
  return {
    name: "Deep plate (placeholder)",
    layers: rings.map(ringPath),
    closed: true,
    // Slightly wider than the spacing, so neighbouring beads merge into one surface.
    beadRadius: spacing * 0.65,
    center: [0, 20 * PLACEHOLDER_SCALE, 0],
    size: 240 * PLACEHOLDER_SCALE,
  };
}
