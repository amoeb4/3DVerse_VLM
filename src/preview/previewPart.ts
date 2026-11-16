import type { PartGeometry, Point3 } from "../components/part/partGeometry";
import {
  LAYER_SAMPLES,
  SIGNAL_IDS,
  type BuildRecord,
  type LayerRecord,
  type SignalId,
} from "../live/processFeed";
import { beadProgress, type MpfProgram } from "./mpf";

/** The bead's half-width: the CAM's 1.2 mm bead, drawn wider so the layers merge, as `waamPart`. */
const BEAD_RADIUS = 1.6;
/** Paths simplified to this, mm: the part does not need the program's every point. */
const SIMPLIFY_MM = 0.05;

/**
 * The part a program lays, as the Part mode draws one (`PartModel`): one path per bead, in the
 * order they are laid — `earlier` programs' first, which Preview shows as laid already.
 *
 * In the part's space (`PartInCell` with an `origin`): millimetres, Y up, from the programs'
 * `G54`: [x, y, z] = [X, Z, −Y].
 */
export function previewGeometry(
  programs: readonly MpfProgram[],
  name: string,
): PartGeometry {
  const layers: Point3[][] = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const program of programs) {
    const p = program.position;
    for (const { start, end } of program.beads) {
      const path: Point3[] = [];
      for (let i = start; i <= end; i += 1) {
        const point: Point3 = [p[i * 3], p[i * 3 + 2], -p[i * 3 + 1]];
        path.push(point);
        for (let k = 0; k < 3; k += 1) {
          min[k] = Math.min(min[k], point[k]);
          max[k] = Math.max(max[k], point[k]);
        }
      }
      layers.push(simplify(path, SIMPLIFY_MM));
    }
  }
  const empty = layers.length === 0;
  return {
    name,
    layers,
    // Rings and open arcs alike: each drawn as it comes.
    closed: false,
    beadRadius: BEAD_RADIUS,
    center: empty
      ? [0, 0, 0]
      : [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size: empty
      ? 100
      : Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
  };
}

/** Nothing measured: the part is drawn in its neutral colour. */
const NO_SAMPLES = Object.fromEntries(
  SIGNAL_IDS.map((id) => [id, new Float32Array(LAYER_SAMPLES).fill(NaN)]),
) as Record<SignalId, Float32Array>;

/**
 * What of the part is laid, as the Part mode's build record (`BuildRecord`), for the program
 * `current` of `programs` at point `index`, `fraction` of the way to the next: the programs before
 * it laid whole, its own beads up to the one under way. Records are kept from one call to the
 * next and changed in place, as the live record is, their `version` bumped when they change.
 */
export class PreviewRecord {
  readonly #programs: readonly MpfProgram[];
  readonly #current: number;
  /** The first bead of each program, in the part's layers. */
  readonly #offsets: number[] = [];
  readonly #records: LayerRecord[] = [];
  readonly #layers: number;
  #version = 0;

  constructor(programs: readonly MpfProgram[], current: number) {
    this.#programs = programs;
    this.#current = current;
    let offset = 0;
    for (const program of programs) {
      this.#offsets.push(offset);
      offset += program.beads.length;
    }
    this.#layers = offset;
    for (let layer = 1; layer <= this.#layers; layer += 1) {
      this.#records.push({
        layer,
        startedAt: 0,
        endedAt: 0,
        progress: 0,
        samples: NO_SAMPLES,
        version: 0,
      });
    }
  }

  /** The bead under way at point `index` of the current program (-1 before the first). */
  at(index: number, fraction: number): BuildRecord {
    const program = this.#programs[this.#current];
    const { bead, progress } = beadProgress(program, index, fraction);
    const offset = this.#offsets[this.#current];
    // Laid: every bead before the one under way (the earlier programs' all), and its share of it.
    const underWay = bead < 0 ? offset : offset + bead;
    const share = bead < 0 ? 0 : progress;
    let changed = false;
    this.#records.forEach((record, i) => {
      const next = i < underWay ? 1 : i === underWay ? share : 0;
      if (next !== record.progress) {
        record.progress = next;
        record.version += 1;
        changed = true;
      }
    });
    if (changed) this.#version += 1;
    const shown = this.#records.slice(0, underWay + 1);
    return {
      source: "replay",
      layers: this.#layers,
      currentLayer: underWay + 1,
      arcOn: program.arc[Math.min(program.count - 1, index + 1)] === 1,
      // `PartModel` drops the layers past the last record: none for what is still to lay.
      records: shown,
      version: this.#version,
    };
  }
}

//------------------------------------------------------------------------------
/** A polyline simplified to `tolerance` (Ramer–Douglas–Peucker), its ends kept. */
function simplify(points: Point3[], tolerance: number): Point3[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const squared = tolerance * tolerance;
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let farthest = squared;
    for (let i = first + 1; i < last; i += 1) {
      const d = segmentDistanceSq(points[i], points[first], points[last]);
      if (d > farthest) {
        farthest = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function segmentDistanceSq(p: Point3, a: Point3, b: Point3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const length = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t =
    length > 0
      ? Math.max(
          0,
          Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / length),
        )
      : 0;
  const d = [ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t];
  return d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
}
