import * as THREE from "three";

/**
 * Forward and inverse kinematics of the cell's robots, as their scenes draw them.
 *
 * A robot's axis is a `part_N` entity turned by its `eulerOrientation`, as the live feed does it
 * (`webSockets.tsx`, from the bridge's `orientationMap` in `grpc_proxy.ts`): one of its three Euler
 * angles follows the axis's value, the other two stay put. 3dverse composes them as
 * R = Rz(z) · Ry(y) · Rx(x), so whichever angle moves, the entity turns about a line fixed in its
 * parent: a revolute joint.
 *
 * The chain is measured on the scene itself (`chainFromScene`): what lies between two axes is
 * rigid, so the kinematics are those of the robot as drawn, whatever robot it is — not a model
 * of it that could drift from what is on screen.
 *
 * Units: the scene's (metres in world space), angles in degrees for the axes' values.
 */

/** Which of the entity's three Euler angles an axis turns. */
export type EulerIndex = 0 | 1 | 2;

/**
 * How an axis's value (in the controller's convention, degrees) becomes its entity's
 * `eulerOrientation`: `zero` at 0, `zero[index] + sign × value` on the angle that moves.
 */
export type AxisSpec = {
  index: EulerIndex;
  zero: readonly [number, number, number];
  sign?: 1 | -1;
};

export type Euler3 = [number, number, number];

export function axisEuler(spec: AxisSpec, value: number): Euler3 {
  const euler: Euler3 = [spec.zero[0], spec.zero[1], spec.zero[2]];
  euler[spec.index] += (spec.sign ?? 1) * value;
  return euler;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

/** 3dverse's `eulerOrientation` (degrees) as a quaternion: Rz · Ry · Rx. */
export function eulerQuaternion(
  [x, y, z]: readonly number[],
  target = new THREE.Quaternion(),
): THREE.Quaternion {
  const d = THREE.MathUtils.DEG2RAD;
  target.setFromAxisAngle(Z, z * d);
  qa.setFromAxisAngle(Y, y * d);
  qb.setFromAxisAngle(X, x * d);
  return target.multiply(qa).multiply(qb);
}

/** One axis of a chain: its entity's own placement, and what is rigid between it and the next. */
export type ChainLink = {
  spec: AxisSpec;
  /** The entity's local position and scale, which the axis does not change. */
  position: THREE.Vector3;
  scale: THREE.Vector3;
  /** From this axis's frame to the next axis's parent's frame (to the tool, for the last). */
  next: THREE.Matrix4;
};

/** Axes in a row, from `base` (the first one's parent, in world space) to the tool. */
export type Chain = { base: THREE.Matrix4; links: ChainLink[] };

const scratchQ = new THREE.Quaternion();
const scratchM = new THREE.Matrix4();

/** The tool's world matrix for the axes at `values`. */
export function forward(
  chain: Chain,
  values: readonly number[],
  target = new THREE.Matrix4(),
): THREE.Matrix4 {
  target.copy(chain.base);
  chain.links.forEach((link, i) => {
    eulerQuaternion(axisEuler(link.spec, values[i] ?? 0), scratchQ);
    scratchM.compose(link.position, scratchQ, link.scale);
    target.multiply(scratchM).multiply(link.next);
  });
  return target;
}

/** An entity as the chain is measured on: its world matrix, its local transform. */
export type MeasuredEntity = {
  worldMatrix: THREE.Matrix4;
  /** Its parent's world matrix. */
  parentMatrix: THREE.Matrix4;
  position: readonly number[];
  scale: readonly number[];
};

/**
 * The chain through `axes` to `tool`, measured where they stand now. Each axis must be a
 * descendant of the one before it, and the tool of the last.
 */
export function chainFromScene(
  axes: readonly { entity: MeasuredEntity; spec: AxisSpec }[],
  tool: { worldMatrix: THREE.Matrix4 },
): Chain {
  const links = axes.map(({ entity, spec }, i): ChainLink => {
    const following = axes[i + 1]?.entity.parentMatrix ?? tool.worldMatrix;
    return {
      spec,
      position: new THREE.Vector3(...entity.position),
      scale: new THREE.Vector3(...entity.scale),
      next: entity.worldMatrix.clone().invert().multiply(following),
    };
  });
  return { base: axes[0].entity.parentMatrix.clone(), links };
}

/**
 * The axes' values for which `forward` gives back the entities' orientations as they stand, each
 * the one that brings its quaternion nearest (the two fixed angles may not be exactly `zero`'s).
 */
export function valuesOf(
  specs: readonly AxisSpec[],
  orientations: readonly (readonly number[])[],
): number[] {
  return specs.map((spec, i) => {
    const current = new THREE.Quaternion(...orientations[i]).normalize();
    // A coarse sweep, then a fine one around the best.
    let best = 0;
    let bestDot = -1;
    const probe = new THREE.Quaternion();
    const sweep = (from: number, to: number, step: number) => {
      for (let v = from; v <= to; v += step) {
        const dot = Math.abs(
          eulerQuaternion(axisEuler(spec, v), probe).dot(current),
        );
        if (dot > bestDot) {
          bestDot = dot;
          best = v;
        }
      }
    };
    sweep(-180, 180, 1);
    sweep(best - 1, best + 1, 0.01);
    return best;
  });
}

//------------------------------------------------------------------------------
// Inverse kinematics.
//------------------------------------------------------------------------------

export type ToolTarget = {
  /** Where the tool's tip goes, in world space. */
  position: THREE.Vector3;
  /**
   * Which way the torch points, in world space, as a unit vector from its tip up to its body —
   * the tool orientation of a Sinumerik program (`A3 B3 C3`).
   */
  axis: THREE.Vector3;
};

export type IkOptions = {
  /** The tool's axis, in the tool's frame: the unit vector from its tip up to its body. */
  toolAxis: THREE.Vector3;
  /** Each axis's limits, degrees; none, free. */
  limits?: readonly (readonly [number, number] | undefined)[];
  /** Iterations at most. */
  iterations?: number;
};

export type IkResult = {
  values: number[];
  /** What is left once solved: the tip's distance to its target, world units. */
  positionError: number;
  /** And the angle between the torch and its orientation, degrees. */
  angleError: number;
};

/**
 * Orientation weighs as much as a tip this far off per radian, world units (m): a degree is worth
 * 1.7 mm.
 */
const ORIENTATION_LENGTH = 0.1;
/** Damping of the least squares, against the jumps near singularities. */
const DAMPING = 0.02;
/** Close enough: 0.05 mm and 0.05°. */
const POSITION_TOLERANCE = 5e-5;
const ANGLE_TOLERANCE = THREE.MathUtils.degToRad(0.05);
/** The step a single iteration may take on an axis, degrees. */
const MAX_STEP_DEG = 20;
const FINITE_STEP_DEG = 1e-3;

const tool = new THREE.Matrix4();
const probe = new THREE.Matrix4();
const tip = new THREE.Vector3();
const axis = new THREE.Vector3();
const probeTip = new THREE.Vector3();
const probeAxis = new THREE.Vector3();
const rotation = new THREE.Matrix3();

function toolPose(
  chain: Chain,
  values: readonly number[],
  toolAxis: THREE.Vector3,
  outTip: THREE.Vector3,
  outAxis: THREE.Vector3,
  matrix: THREE.Matrix4,
) {
  forward(chain, values, matrix);
  outTip.setFromMatrixPosition(matrix);
  rotation.setFromMatrix4(matrix);
  outAxis.copy(toolAxis).applyMatrix3(rotation).normalize();
}

/** The error as a 6-vector: the tip's offset, then the axis's rotation to its target, weighted. */
function errorOf(
  target: ToolTarget,
  currentTip: THREE.Vector3,
  currentAxis: THREE.Vector3,
  out: Float64Array,
) {
  out[0] = target.position.x - currentTip.x;
  out[1] = target.position.y - currentTip.y;
  out[2] = target.position.z - currentTip.z;
  // The rotation that takes the torch onto its orientation: its axis, times its angle.
  const cross = new THREE.Vector3().crossVectors(currentAxis, target.axis);
  const sin = cross.length();
  const cos = currentAxis.dot(target.axis);
  const angle = Math.atan2(sin, cos);
  if (sin > 1e-12) cross.multiplyScalar(angle / sin);
  out[3] = cross.x * ORIENTATION_LENGTH;
  out[4] = cross.y * ORIENTATION_LENGTH;
  out[5] = cross.z * ORIENTATION_LENGTH;
  return angle;
}

/**
 * The axes' values that bring the tool onto `target`, from `seed` (the values of the moment
 * before, so the arm moves the least): damped least squares on the chain's Jacobian, found by
 * finite differences — 5 constraints (the tip, the torch's direction) on 6 axes, the turn about
 * the torch left to whatever moves least.
 */
export function solve(
  chain: Chain,
  target: ToolTarget,
  seed: readonly number[],
  { toolAxis, limits, iterations = 30 }: IkOptions,
): IkResult {
  const n = chain.links.length;
  const values = [...seed];
  const error = new Float64Array(6);
  const jacobian = Array.from({ length: 6 }, () => new Float64Array(n));
  let angle = 0;

  for (let iteration = 0; ; iteration += 1) {
    toolPose(chain, values, toolAxis, tip, axis, tool);
    angle = errorOf(target, tip, axis, error);
    const distance = Math.hypot(error[0], error[1], error[2]);
    if (
      (distance < POSITION_TOLERANCE && angle < ANGLE_TOLERANCE) ||
      iteration >= iterations
    ) {
      return {
        values,
        positionError: distance,
        angleError: THREE.MathUtils.radToDeg(angle),
      };
    }

    // The Jacobian, per radian of each axis.
    for (let j = 0; j < n; j += 1) {
      const saved = values[j];
      values[j] = saved + FINITE_STEP_DEG;
      toolPose(chain, values, toolAxis, probeTip, probeAxis, probe);
      values[j] = saved;
      const h = THREE.MathUtils.degToRad(FINITE_STEP_DEG);
      jacobian[0][j] = (probeTip.x - tip.x) / h;
      jacobian[1][j] = (probeTip.y - tip.y) / h;
      jacobian[2][j] = (probeTip.z - tip.z) / h;
      // The axis's rotation, as a small angle vector: axis × (d axis).
      const d = new THREE.Vector3().subVectors(probeAxis, axis).divideScalar(h);
      const w = new THREE.Vector3().crossVectors(axis, d);
      jacobian[3][j] = w.x * ORIENTATION_LENGTH;
      jacobian[4][j] = w.y * ORIENTATION_LENGTH;
      jacobian[5][j] = w.z * ORIENTATION_LENGTH;
    }

    // Δ = Jᵀ (J Jᵀ + λ² I)⁻¹ e
    const jjt = Array.from({ length: 6 }, (_, r) =>
      Array.from({ length: 6 }, (_, c) => {
        let sum = r === c ? DAMPING * DAMPING : 0;
        for (let k = 0; k < n; k += 1) sum += jacobian[r][k] * jacobian[c][k];
        return sum;
      }),
    );
    const y = solveLinear(jjt, Array.from(error));
    if (!y) {
      return {
        values,
        positionError: distance,
        angleError: THREE.MathUtils.radToDeg(angle),
      };
    }
    for (let j = 0; j < n; j += 1) {
      let step = 0;
      for (let r = 0; r < 6; r += 1) step += jacobian[r][j] * y[r];
      step = THREE.MathUtils.clamp(
        THREE.MathUtils.radToDeg(step),
        -MAX_STEP_DEG,
        MAX_STEP_DEG,
      );
      let next = values[j] + step;
      const limit = limits?.[j];
      if (limit) next = THREE.MathUtils.clamp(next, limit[0], limit[1]);
      values[j] = next;
    }
  }
}

/** `A x = b` by Gaussian elimination with partial pivoting; `null` if singular. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-14) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r += 1) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = m[r][n];
    for (let c = r + 1; c < n; c += 1) sum -= m[r][c] * x[c];
    x[r] = sum / m[r][r];
  }
  return x;
}
