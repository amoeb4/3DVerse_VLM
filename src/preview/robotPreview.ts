import * as THREE from "three";
import type { Entity } from "@3dverse/livelink";

import type { RobotKinematics } from "../config";
import {
  axisEuler,
  chainFromScene,
  eulerQuaternion,
  forward,
  solve,
  valuesOf,
  type Chain,
  type Euler3,
  type MeasuredEntity,
  type ToolTarget,
} from "./kinematics";
import type { MpfProgram } from "./mpf";

/** The arm's six axes, then the positioner's tilt and turntable, degrees from the scene's pose. */
export type RobotPose = number[];

/** A program's axes, solved point by point (`RobotPreview.solveProgram`). */
export type ProgramSolution = {
  /** 8 values per point: `RobotPose`. */
  poses: Float32Array;
  /** Per point, how far the tip stays from its target, mm (0: on it). */
  positionError: Float32Array;
  /** Per point, how far the torch stays from its orientation, degrees. */
  angleError: Float32Array;
  /** Points out of reach: further than `REACH_MM` or `REACH_DEG`. */
  unreachable: number;
  worstMm: number;
  worstDeg: number;
};

export const AXIS_COUNT = 8;
/** On target within these. */
const REACH_MM = 0.5;
const REACH_DEG = 0.5;
/** Steps from where the arm stands to the program's first point. */
const APPROACH_STEPS = 40;
/** Points solved between two breaths, so the page stays responsive. */
const CHUNK = 1500;

const matrixOf = (entity: Entity) =>
  new THREE.Matrix4().fromArray(entity.ls_to_ws as unknown as number[]);

const measure = (entity: Entity): MeasuredEntity => ({
  worldMatrix: matrixOf(entity),
  parentMatrix: entity.parent ? matrixOf(entity.parent) : new THREE.Matrix4(),
  position: entity.local_transform?.position ?? [0, 0, 0],
  scale: entity.local_transform?.scale ?? [1, 1, 1],
});

/**
 * A robot of the cell playing a part program back: its arm and positioner measured on the scene
 * (`kinematics.ts`), the program's moves solved into the axes' values (the inverse kinematics),
 * and those written on the scene's `part_N` entities, as the live feed would.
 *
 * Built on the entities as they stand; `restore` puts them back so.
 */
export class RobotPreview {
  readonly #axes: Entity[];
  readonly #kinematics: RobotKinematics;
  readonly #arm: Chain;
  readonly #positioner: Chain;
  readonly #toolAxis: THREE.Vector3;
  readonly #saved: { entity: Entity; orientation: number[] }[];
  /** Where the axes stood when measured. */
  readonly #start: RobotPose;
  #last: string[] = [];

  /**
   * `axes`: `part_1` to `part_8`; `workpiece`, the entity the part's frame is on. `null` with the
   * reason, if the scene does not have what the kinematics need.
   */
  static create(
    axes: (Entity | undefined)[],
    workpiece: Entity | null,
    kinematics: RobotKinematics,
  ): RobotPreview | string {
    const missing = axes
      .map((entity, i) => (entity ? null : `part_${i + 1}`))
      .filter(Boolean);
    if (missing.length > 0) {
      return `The scene has no ${missing.join(", ")}.`;
    }
    if (!workpiece) {
      return "The scene has no entity for the part's frame.";
    }
    if (axes.some((entity) => !entity!.ls_to_ws) || !workpiece.ls_to_ws) {
      return "The robot is not placed in the scene yet.";
    }
    return new RobotPreview(axes as Entity[], workpiece, kinematics);
  }

  private constructor(
    axes: Entity[],
    workpiece: Entity,
    kinematics: RobotKinematics,
  ) {
    this.#axes = axes;
    this.#kinematics = kinematics;
    const specs = kinematics.axes;
    const [p1, p2, p3, p4, p5, p6, p7, p8] = axes;

    const flange = matrixOf(p6);
    const tcp = new THREE.Matrix4().makeTranslation(
      ...(kinematics.tool.tcp as [number, number, number]),
    );
    this.#arm = chainFromScene(
      [p1, p2, p3, p4, p5, p6].map((entity, i) => ({
        entity: measure(entity),
        spec: specs[i],
      })),
      { worldMatrix: flange.multiply(tcp) },
    );
    this.#toolAxis = new THREE.Vector3(
      ...(kinematics.tool.axis as [number, number, number]),
    ).normalize();

    // The part's frame, G54: millimetres, wherever the entity's units are.
    const workpieceWorld = matrixOf(workpiece);
    const metresPerUnit = new THREE.Vector3()
      .setFromMatrixColumn(workpieceWorld, 0)
      .length();
    const perMm = 0.001 / metresPerUnit;
    const g54 = workpieceWorld
      .multiply(
        new THREE.Matrix4().makeTranslation(
          ...(kinematics.workpiece.origin as [number, number, number]),
        ),
      )
      .multiply(new THREE.Matrix4().makeScale(perMm, perMm, perMm));
    this.#positioner = chainFromScene(
      [p7, p8].map((entity, i) => ({
        entity: measure(entity),
        spec: specs[6 + i],
      })),
      { worldMatrix: g54 },
    );

    this.#saved = axes.map((entity) => ({
      entity,
      orientation: [
        ...(entity.local_transform?.orientation ?? [0, 0, 0, 1]),
      ] as number[],
    }));
    this.#start = valuesOf(
      specs,
      this.#saved.map(({ orientation }) => orientation),
    );
  }

  /** Where the axes stood when measured. */
  get startPose(): RobotPose {
    return [...this.#start];
  }

  /** The part's frame (G54, mm) in world space, for the positioner at `tilt` and `turn`. */
  workpieceMatrix(
    tilt: number,
    turn: number,
    target = new THREE.Matrix4(),
  ): THREE.Matrix4 {
    return forward(this.#positioner, [tilt, turn], target);
  }

  /**
   * Every point's axes, by inverse kinematics: from where the arm stands, eased onto the first
   * point, then each point from the one before, so the arm moves as little as it can and never
   * jumps between two configurations. In chunks, yielding between them; `onProgress` (0–1)
   * after each. Rejects with an `AbortError` once `signal` aborts.
   */
  async solveProgram(
    program: MpfProgram,
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ): Promise<ProgramSolution> {
    const { count } = program;
    const poses = new Float32Array(count * AXIS_COUNT);
    const positionError = new Float32Array(count);
    const angleError = new Float32Array(count);
    const options = { toolAxis: this.#toolAxis, iterations: 40 };
    const g54 = new THREE.Matrix4();
    const rotation = new THREE.Matrix3();

    const targetAt = (i: number): ToolTarget => {
      this.workpieceMatrix(program.tilt[i], program.turn[i], g54);
      rotation.setFromMatrix4(g54);
      return {
        position: new THREE.Vector3(
          program.position[i * 3],
          program.position[i * 3 + 1],
          program.position[i * 3 + 2],
        ).applyMatrix4(g54),
        axis: new THREE.Vector3(
          program.direction[i * 3],
          program.direction[i * 3 + 1],
          program.direction[i * 3 + 2],
        )
          .applyMatrix3(rotation)
          .normalize(),
      };
    };

    // The approach: the tool from where it stands to the first point, in steps.
    let seed = this.#start.slice(0, 6);
    const toolNow = forward(this.#arm, seed);
    const fromTip = new THREE.Vector3().setFromMatrixPosition(toolNow);
    const fromAxis = this.#toolAxis
      .clone()
      .applyMatrix3(new THREE.Matrix3().setFromMatrix4(toolNow))
      .normalize();
    const first = targetAt(0);
    const swing = new THREE.Quaternion().setFromUnitVectors(
      fromAxis,
      first.axis,
    );
    const partial = new THREE.Quaternion();
    for (let step = 1; step <= APPROACH_STEPS; step += 1) {
      const t = step / APPROACH_STEPS;
      partial.identity().slerp(swing, t);
      seed = solve(
        this.#arm,
        {
          position: fromTip.clone().lerp(first.position, t),
          axis: fromAxis.clone().applyQuaternion(partial),
        },
        seed,
        options,
      ).values;
    }

    let unreachable = 0;
    let worstMm = 0;
    let worstDeg = 0;
    for (let i = 0; i < count; i += 1) {
      if (i % CHUNK === 0) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        onProgress(i / count);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      // A move in the axes' own values (the park, `RA1…`): their convention is the controller's,
      // not the scene's; the arm holds where it was.
      if (!program.jointMoves.has(i)) {
        const result = solve(this.#arm, targetAt(i), seed, options);
        seed = result.values;
        const mm = result.positionError * 1000;
        positionError[i] = mm;
        angleError[i] = result.angleError;
        if (mm > REACH_MM || result.angleError > REACH_DEG) unreachable += 1;
        worstMm = Math.max(worstMm, mm);
        worstDeg = Math.max(worstDeg, result.angleError);
      }
      poses.set(seed, i * AXIS_COUNT);
      poses[i * AXIS_COUNT + 6] = program.tilt[i];
      poses[i * AXIS_COUNT + 7] = program.turn[i];
    }
    onProgress(1);
    return { poses, positionError, angleError, unreachable, worstMm, worstDeg };
  }

  /** The axes between point `index` and the next, `fraction` of the way. */
  static poseAt(
    solution: ProgramSolution,
    index: number,
    fraction: number,
    target: RobotPose = new Array<number>(AXIS_COUNT).fill(0),
  ): RobotPose {
    const { poses } = solution;
    const count = poses.length / AXIS_COUNT;
    const a = Math.min(index, count - 1) * AXIS_COUNT;
    const b = Math.min(index + 1, count - 1) * AXIS_COUNT;
    for (let j = 0; j < AXIS_COUNT; j += 1) {
      target[j] = poses[a + j] + (poses[b + j] - poses[a + j]) * fraction;
    }
    return target;
  }

  /** The axes at `pose`, on the scene (`writeOrientation`). Only those that changed are sent. */
  apply(pose: RobotPose) {
    this.#axes.forEach((entity, i) => {
      const euler = axisEuler(this.#kinematics.axes[i], pose[i]);
      const key = euler.map((v) => v.toFixed(3)).join(",");
      if (this.#last[i] === key) return;
      this.#last[i] = key;
      writeOrientation(entity, euler);
    });
  }

  /**
   * Calls `onExternal` whenever someone else (another viewer, another app) moves one of the
   * robot's axes; the next `apply` then sends every axis again, so the playback takes the arm
   * back. Returns what stops listening.
   */
  watchExternal(onExternal: () => void): () => void {
    const abort = new AbortController();
    for (const entity of this.#axes) {
      entity.addEventListener(
        "on-entity-updated",
        (event) => {
          if (event.isExternal() && event.includes("local_transform")) {
            this.#last = [];
            onExternal();
          }
        },
        { signal: abort.signal },
      );
    }
    return () => abort.abort();
  }

  /** The axes back where they stood when measured. */
  restore() {
    this.#last = [];
    for (const { entity, orientation } of this.#saved) {
      const q = new THREE.Quaternion(...(orientation as Quat4)).normalize();
      const e = new THREE.Euler().setFromQuaternion(q, "ZYX");
      writeOrientation(
        entity,
        [e.x, e.y, e.z].map((v) => THREE.MathUtils.radToDeg(v)) as Euler3,
        q,
      );
    }
  }
}

type Quat4 = [number, number, number, number];

/**
 * An entity's orientation, its quaternion and its Euler angles alike, through `updateComponent`.
 *
 * Not through `local_transform.orientation =` / `.eulerOrientation =`: Livelink's proxies for the
 * two (`@3dverse/livelink` 0.8) each write into the array they were made on, then *replace* the
 * other field's array. Once one has been set, setting the other writes into an array no longer
 * the entity's, and is silently lost — the arm froze as soon as both had been used (the live feed
 * sets Euler angles; anything else that sets the quaternion breaks it, and the other way round).
 * `updateComponent` copies the values into the arrays the entity holds, and keeps its world
 * matrices in step.
 */
function writeOrientation(
  entity: Entity,
  euler: Euler3,
  quaternion = eulerQuaternion(euler),
) {
  entity.updateComponent("local_transform", {
    orientation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    eulerOrientation: euler,
  });
}
