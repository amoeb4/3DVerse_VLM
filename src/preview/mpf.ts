/**
 * Siemens Sinumerik part programs (`.mpf`) as the cell's CAM writes them for WAAM, read for their
 * playback (Preview mode).
 *
 * What the programs hold, and what is kept:
 * - `TRAORI` moves: `X Y Z` the torch tip in the part's frame (`G54`, millimetres), `A3 B3 C3`
 *   the torch's direction (from its tip up to its body), `AN3 BN3 CN3` a second vector (not used:
 *   the torch is turned about its axis as the arm moves least), `DD` and `FF` the positioner's
 *   two axes (the cradle's tilt and the turntable, degrees), `F` the feed (mm/min). All modal.
 * - `ARC_ON` / `ARC_OFF`: the deposition, between them; each run is one bead.
 * - `MSG("Operation=… Layer=n …")`: the layer the next beads belong to.
 * - `TRAFOOF` then `RA1=… RA6=…`: a move in the axes' own values (degrees), the arm's park.
 * Everything else (cycles, dwell, weaving) is skipped.
 */

export type MpfBead = {
  /** Points `start` to `end`, inclusive: `start` is where the arc struck. */
  start: number;
  end: number;
  /** The program's `Layer=`. */
  layer: number;
};

export type MpfProgram = {
  name: string;
  /** The `Operation=` of its first message, else its file name. */
  operation: string;
  count: number;
  /** x, y, z per point: the torch tip, mm, in `G54`. */
  position: Float64Array;
  /** The torch's direction, unit, from its tip to its body. */
  direction: Float32Array;
  /** The positioner's axes, degrees: the cradle's tilt (`DD`), the turntable (`FF`). */
  tilt: Float32Array;
  turn: Float32Array;
  /** Whether the move to this point lays metal. */
  arc: Uint8Array;
  /** The program's layer at this point. */
  layer: Uint16Array;
  /** Seconds from the program's start to this point. */
  time: Float64Array;
  /** Points reached by a move in axis values (`RA1…RA6`), and those values. */
  jointMoves: Map<number, number[]>;
  beads: MpfBead[];
  layers: number;
  duration: number;
};

/** How fast what the feed does not cover moves, so moves of it alone take some time. */
const TURN_DEG_PER_S = 30;
const TILT_DEG_PER_S = 20;
const ORIENTATION_DEG_PER_S = 30;
/** A move in axis values: the arm's park, at the end. */
const JOINT_MOVE_S = 4;

const OPERATION = /Operation=(\S+)/;
const LAYER = /Layer=(\d+)/;

/** A program's text, read. Throws if it holds no move. */
export function parseMpf(text: string, name: string): MpfProgram {
  // Upper bound on the points: one per line.
  let capacity = 1024;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) capacity += 1;
  }
  const position = new Float64Array(capacity * 3);
  const direction = new Float32Array(capacity * 3);
  const tilt = new Float32Array(capacity);
  const turn = new Float32Array(capacity);
  const arc = new Uint8Array(capacity);
  const layer = new Uint16Array(capacity);
  const time = new Float64Array(capacity);
  const jointMoves = new Map<number, number[]>();
  const beads: MpfBead[] = [];

  // Modal state.
  let x = NaN;
  let y = NaN;
  let z = NaN;
  let a = 0;
  let b = 0;
  let c = 1;
  let dd = 0;
  let ff = 0;
  let feed = 1000;
  let arcOn = false;
  let currentLayer = 1;
  let maxLayer = 1;
  let operation = "";
  let count = 0;
  let bead: MpfBead | null = null;

  const push = (joints: number[] | null) => {
    const i = count;
    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    const norm = Math.hypot(a, b, c) || 1;
    direction[i * 3] = a / norm;
    direction[i * 3 + 1] = b / norm;
    direction[i * 3 + 2] = c / norm;
    tilt[i] = dd;
    turn[i] = ff;
    arc[i] = arcOn ? 1 : 0;
    layer[i] = currentLayer;
    if (joints) jointMoves.set(i, joints);
    if (i === 0) {
      time[i] = 0;
    } else {
      let dt: number;
      if (joints) {
        dt = JOINT_MOVE_S;
      } else {
        const j = (i - 1) * 3;
        const distance = Math.hypot(
          x - position[j],
          y - position[j + 1],
          z - position[j + 2],
        );
        const dot =
          direction[i * 3] * direction[j] +
          direction[i * 3 + 1] * direction[j + 1] +
          direction[i * 3 + 2] * direction[j + 2];
        const turned =
          (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
        dt = Math.max(
          (distance / Math.max(1, feed)) * 60,
          Math.abs(ff - turn[i - 1]) / TURN_DEG_PER_S,
          Math.abs(dd - tilt[i - 1]) / TILT_DEG_PER_S,
          turned / ORIENTATION_DEG_PER_S,
          1e-3,
        );
      }
      time[i] = time[i - 1] + dt;
    }
    if (bead && arcOn) bead.end = i;
    count += 1;
  };

  let start = 0;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    let line = text.slice(start, end);
    start = end + 1;

    const comment = line.indexOf(";");
    if (comment >= 0) line = line.slice(0, comment);
    line = line.trim();
    // The block number.
    if (line.charCodeAt(0) === 78 /* N */) {
      const space = line.indexOf(" ");
      line = space < 0 ? "" : line.slice(space + 1).trim();
    }
    if (!line) continue;

    if (line.startsWith("MSG")) {
      const op = OPERATION.exec(line);
      if (op && !operation) operation = op[1];
      const l = LAYER.exec(line);
      if (l) {
        currentLayer = Number(l[1]);
        maxLayer = Math.max(maxLayer, currentLayer);
      }
      continue;
    }
    if (line.startsWith("ARC_ON")) {
      arcOn = true;
      // The bead starts where the torch stands when the arc strikes.
      if (count > 0) {
        bead = { start: count - 1, end: count - 1, layer: currentLayer };
        beads.push(bead);
      }
      continue;
    }
    if (line.startsWith("ARC_OFF")) {
      arcOn = false;
      bead = null;
      continue;
    }

    // A move, or nothing this playback needs.
    let moved = false;
    let joints: number[] | null = null;
    for (const token of line.split(/\s+/)) {
      const eq = token.indexOf("=");
      let key: string;
      let value: number;
      if (eq >= 0) {
        key = token.slice(0, eq);
        value = Number(token.slice(eq + 1));
      } else {
        const letters = /^[A-Z]+/.exec(token);
        if (!letters) continue;
        key = letters[0];
        value = Number(token.slice(key.length));
      }
      if (Number.isNaN(value)) continue;
      switch (key) {
        case "X":
          x = value;
          moved = true;
          break;
        case "Y":
          y = value;
          moved = true;
          break;
        case "Z":
          z = value;
          moved = true;
          break;
        case "A3":
          a = value;
          moved = true;
          break;
        case "B3":
          b = value;
          moved = true;
          break;
        case "C3":
          c = value;
          moved = true;
          break;
        case "DD":
          dd = value;
          moved = true;
          break;
        case "FF":
          ff = value;
          moved = true;
          break;
        case "F":
          feed = value;
          break;
        default: {
          const ra = /^RA([1-9])$/.exec(key);
          if (ra) {
            joints ??= [];
            joints[Number(ra[1]) - 1] = value;
            moved = true;
          }
        }
      }
    }
    // Before the first full position, nothing to show.
    if (moved && !Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) {
      push(joints);
    }
  }

  if (count === 0) {
    throw new Error(`${name}: no move found`);
  }
  return {
    name,
    operation: operation || name.replace(/\.mpf$/i, ""),
    count,
    position: position.subarray(0, count * 3),
    direction: direction.subarray(0, count * 3),
    tilt: tilt.subarray(0, count),
    turn: turn.subarray(0, count),
    arc: arc.subarray(0, count),
    layer: layer.subarray(0, count),
    time: time.subarray(0, count),
    jointMoves,
    beads: beads.filter((bead) => bead.end > bead.start),
    layers: maxLayer,
    duration: time[count - 1],
  };
}

/** The point the program is at, `t` seconds in: the move under way, and how far along it. */
export function pointAt(
  program: MpfProgram,
  t: number,
): { index: number; fraction: number } {
  const { time, count } = program;
  if (t <= 0) return { index: 0, fraction: 0 };
  if (t >= time[count - 1]) return { index: count - 1, fraction: 0 };
  // The last point reached by `t`.
  let low = 0;
  let high = count - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (time[mid] <= t) low = mid;
    else high = mid;
  }
  const span = time[high] - time[low];
  return { index: low, fraction: span > 0 ? (t - time[low]) / span : 0 };
}

/** The bead under way or last laid at point `index`, and how much of it is laid, 0–1. */
export function beadProgress(
  program: MpfProgram,
  index: number,
  fraction: number,
): { bead: number; progress: number } {
  const { beads } = program;
  // The last bead started by `index`.
  let low = -1;
  let high = beads.length;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (beads[mid].start <= index) low = mid;
    else high = mid;
  }
  if (low < 0) return { bead: -1, progress: 0 };
  const bead = beads[low];
  if (index >= bead.end) return { bead: low, progress: 1 };
  // By length along the bead, as the part draws it.
  const lengths = beadLengths(program, low);
  const at = index - bead.start;
  const done = lengths[at] + (lengths[at + 1] - lengths[at]) * fraction;
  return {
    bead: low,
    progress:
      lengths[lengths.length - 1] > 0 ? done / lengths[lengths.length - 1] : 1,
  };
}

const lengthCache = new WeakMap<MpfProgram, Map<number, Float64Array>>();

/** A bead's cumulated length at each of its points, mm. */
function beadLengths(program: MpfProgram, index: number): Float64Array {
  let byBead = lengthCache.get(program);
  if (!byBead) {
    byBead = new Map();
    lengthCache.set(program, byBead);
  }
  let lengths = byBead.get(index);
  if (!lengths) {
    const { start, end } = program.beads[index];
    const p = program.position;
    lengths = new Float64Array(end - start + 1);
    for (let i = start + 1; i <= end; i += 1) {
      lengths[i - start] =
        lengths[i - start - 1] +
        Math.hypot(
          p[i * 3] - p[i * 3 - 3],
          p[i * 3 + 1] - p[i * 3 - 2],
          p[i * 3 + 2] - p[i * 3 - 1],
        );
    }
    byBead.set(index, lengths);
  }
  return lengths;
}
