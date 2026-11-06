import * as THREE from "three";
import type { Entity } from "@3dverse/livelink";

import { twistAngle, type JointAxis, type JointInfo } from "../joints/joints";
import type { HoloShape } from "./holoTags";
import {
  GlowLines,
  boxBrackets,
  boxEdges,
  cylinderBrackets,
  cylinderEdges,
} from "./GlowLines";
import {
  HOLO_ACCENT,
  RENDER_ORDER,
  createGaugeMaterial,
  createOccluderMaterial,
  createShellMaterial,
} from "./holoMaterials";

//------------------------------------------------------------------------------
// Shared geometry: every shell and gauge is a unit shape scaled by its object's matrix.
//------------------------------------------------------------------------------
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 64, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(2, 2);
const BOX_EDGES = boxEdges();
const BOX_BRACKETS = boxBrackets(0.16, 0.502);
const CYLINDER_EDGES = cylinderEdges();
const CYLINDER_BRACKETS = cylinderBrackets();

/** Turns the unit cylinder, which runs along y, onto the part's local axis. */
const CYLINDER_TO_AXIS: Record<JointAxis, THREE.Quaternion> = {
  x: new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    -Math.PI / 2,
  ),
  y: new THREE.Quaternion(),
  z: new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2,
  ),
};

/**
 * The gauge plane's basis, in the parent's frame: +x where 0° points, +z along the joint's axis, so
 * that positive angles (right-hand rule about the axis) run from +x towards +y. 0° is the next axis
 * round — x → y → z → x — as `JointGauge` and `ringPlaneInView` have it.
 */
const GAUGE_BASIS: Record<JointAxis, THREE.Quaternion> = {
  x: new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
    ),
  ),
  y: new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ),
  ),
  z: new THREE.Quaternion(),
};

const AXIS_INDEX: Record<JointAxis, number> = { x: 0, y: 1, z: 2 };

/** Below this a shell dimension is flat; it is given some thickness so its matrix stays invertible. */
const MIN_EXTENT = 1e-3;
const IDENTITY = new THREE.Quaternion();

/** The intro: each part builds up in turn, this long, this far apart. In seconds. */
const REVEAL_DURATION = 1.1;
const REVEAL_STAGGER = 0.12;
const REVEAL_DELAY = 0.2;

//------------------------------------------------------------------------------
// Scratch, reused every frame by every entity.
//------------------------------------------------------------------------------
const world = new THREE.Matrix4();
const shellLocal = new THREE.Matrix4();
const worldScale = new THREE.Vector3();
const worldPosition = new THREE.Vector3();
const worldRotation = new THREE.Quaternion();
const localRotation = new THREE.Quaternion();
const parentRotation = new THREE.Quaternion();
const gaugeRotation = new THREE.Quaternion();
const shellCenter = new THREE.Vector3();
const projected = new THREE.Vector3();
const gaugeScale = new THREE.Vector3();

const smoothstep = (edge0: number, edge1: number, x: number) =>
  THREE.MathUtils.smoothstep(x, edge0, edge1);

/** A cheap per-frame flicker, for the intro: mostly on, sometimes dimmed. */
const flicker = (time: number, seed: number) =>
  Math.sin(time * 91.7 + seed * 12.9) * 43758.5453 -
    Math.floor(Math.sin(time * 91.7 + seed * 12.9) * 43758.5453) >
  0.35
    ? 1
    : 0.35;

export type FrameContext = {
  time: number;
  /** Seconds since the HUD appeared; `Infinity` skips the intro. */
  introTime: number;
  /** A length the size of the machine, every spacing is a fraction of it. */
  machineSize: number;
};

//------------------------------------------------------------------------------
/**
 * The hologram of one "main" entity, in world space, following it every frame:
 *
 * - its shell — a box, or a cylinder along one of its local axes — as a depth-only occluder, a
 *   glowing grid surface, and soft glowing outlines and brackets that bleed past it;
 * - a gauge laid in the plane the joint turns in, showing its live angle.
 *
 * The shell is fitted to the entity's `local_aabb` merged with its children's (`localBox`), so it
 * turns with the joint. Without one, only the gauge is drawn.
 */
export class HoloEntity {
  readonly root = new THREE.Group();
  readonly entity: Entity;
  readonly info: JointInfo;
  readonly shape: HoloShape;
  readonly pivot = new THREE.Vector3();

  readonly #localBox: THREE.Box3 | null;
  /** The shell's size in the entity's frame: a cylinder's is (diameter, height, diameter) on its axis. */
  readonly #shellSize = new THREE.Vector3();
  readonly #shellGroup = new THREE.Group();
  readonly #occluder: THREE.Mesh;
  readonly #shellMaterial: THREE.ShaderMaterial;
  readonly #edges: GlowLines;
  readonly #brackets: GlowLines;
  readonly #gauge: THREE.Mesh;
  readonly #gaugeMaterial: THREE.ShaderMaterial;
  readonly #index: number;

  #occludes = true;
  #gaugeRadius = 0;

  constructor({
    entity,
    info,
    index,
    shape,
    localBox,
  }: {
    entity: Entity;
    info: JointInfo;
    index: number;
    shape: HoloShape;
    localBox: THREE.Box3 | null;
  }) {
    this.entity = entity;
    this.info = info;
    this.shape = shape;
    this.#index = index;
    this.#localBox = localBox;
    this.root.name = `holo:${entity.name}`;

    const isCylinder = shape.kind === "cylinder";
    if (localBox) {
      localBox.getSize(this.#shellSize);
      if (shape.kind === "cylinder") {
        const along = AXIS_INDEX[shape.axis];
        const diameter = Math.max(
          ...[0, 1, 2]
            .filter((i) => i !== along)
            .map((i) => this.#shellSize.getComponent(i)),
        );
        for (const i of [0, 1, 2]) {
          if (i !== along) {
            this.#shellSize.setComponent(i, diameter);
          }
        }
      }
      this.#shellSize.max(
        new THREE.Vector3(MIN_EXTENT, MIN_EXTENT, MIN_EXTENT),
      );
    }

    // Shell: occluder, surface, outline, brackets — all on the unit shape, turned onto the axis.
    this.#shellGroup.matrixAutoUpdate = false;
    const unit = new THREE.Group();
    if (shape.kind === "cylinder") {
      unit.quaternion.copy(CYLINDER_TO_AXIS[shape.axis]);
    }
    const geometry = isCylinder ? UNIT_CYLINDER : UNIT_BOX;

    this.#occluder = new THREE.Mesh(geometry, createOccluderMaterial());
    this.#occluder.renderOrder = RENDER_ORDER.occluder;
    // A touch smaller than the shell: a bounding volume is looser than the mesh, this hides less of
    // what is only just behind it.
    this.#occluder.scale.setScalar(0.96);

    this.#shellMaterial = createShellMaterial({ cylinder: isCylinder });
    const surface = new THREE.Mesh(geometry, this.#shellMaterial);
    surface.renderOrder = RENDER_ORDER.box;

    this.#edges = new GlowLines(isCylinder ? CYLINDER_EDGES : BOX_EDGES, {
      color: HOLO_ACCENT,
      width: 7,
      core: 0.14,
      glow: 0.45,
      opacity: 0.75,
    });
    this.#brackets = new GlowLines(
      isCylinder ? CYLINDER_BRACKETS : BOX_BRACKETS,
      { width: 10, core: 0.2, glow: 0.7 },
    );

    unit.add(this.#occluder, surface, this.#edges, this.#brackets);
    this.#shellGroup.add(unit);
    this.#shellGroup.visible = localBox !== null;
    this.root.add(this.#shellGroup);

    // Gauge.
    this.#gaugeMaterial = createGaugeMaterial(info.axis);
    this.#gauge = new THREE.Mesh(UNIT_PLANE, this.#gaugeMaterial);
    this.#gauge.matrixAutoUpdate = false;
    this.#gauge.renderOrder = RENDER_ORDER.gauge;
    this.root.add(this.#gauge);
  }

  /** Whether the shell stands in for the mesh in the depth buffer. */
  set occludes(value: boolean) {
    this.#occludes = value;
    this.#occluder.visible = value;
  }

  /** Whether a world-space point lies within this entity's box, as it currently stands. */
  containsPoint(point: THREE.Vector3) {
    if (!this.#localBox) {
      return false;
    }
    world.fromArray(this.entity.ls_to_ws).invert();
    return this.#localBox.containsPoint(
      projected.copy(point).applyMatrix4(world),
    );
  }

  /** The world-space corners of the box, for the machine's overall bounds. */
  expandBox(target: THREE.Box3) {
    if (!this.#localBox) {
      target.expandByPoint(this.pivot);
      return;
    }
    world.fromArray(this.entity.ls_to_ws);
    const { min, max } = this.#localBox;
    for (let i = 0; i < 8; i++) {
      projected
        .set(
          i & 1 ? max.x : min.x,
          i & 2 ? max.y : min.y,
          i & 4 ? max.z : min.z,
        )
        .applyMatrix4(world);
      target.expandByPoint(projected);
    }
  }

  /** Reads where the entity's pivot is now, in world space. */
  syncPivot() {
    this.pivot.fromArray(this.entity.ls_to_ws, 12);
  }

  /** Follows the entity: call once per frame, before rendering. */
  update(frame: FrameContext) {
    const { entity, info } = this;
    world.fromArray(entity.ls_to_ws);
    world.decompose(worldPosition, worldRotation, worldScale);
    this.pivot.copy(worldPosition);

    // Intro: the shell builds up, its outline flickers on, then the gauge.
    const reveal = THREE.MathUtils.clamp(
      (frame.introTime - REVEAL_DELAY - this.#index * REVEAL_STAGGER) /
        REVEAL_DURATION,
      0,
      1,
    );
    const revealing = reveal < 1;
    const blink = revealing ? flicker(frame.time, this.#index) : 1;
    const dim = this.#occludes ? 1 : 0.3;

    // Shell.
    if (this.#localBox) {
      this.#localBox.getCenter(shellCenter);
      shellLocal.compose(shellCenter, IDENTITY, this.#shellSize);
      this.#shellGroup.matrix.multiplyMatrices(world, shellLocal);
      this.#shellGroup.matrixWorldNeedsUpdate = true;

      const uniforms = this.#shellMaterial.uniforms;
      const size = uniforms.uSize.value as THREE.Vector3;
      if (this.shape.kind === "cylinder") {
        // In the unit cylinder's frame: (diameter, height, diameter).
        const along = AXIS_INDEX[this.shape.axis];
        const across = (along + 1) % 3;
        size.set(
          this.#shellSize.getComponent(across) *
            worldScale.getComponent(across),
          this.#shellSize.getComponent(along) * worldScale.getComponent(along),
          this.#shellSize.getComponent(across) *
            worldScale.getComponent(across),
        );
      } else {
        size.copy(this.#shellSize).multiply(worldScale);
      }
      uniforms.uTime.value = frame.time;
      uniforms.uGrid.value = frame.machineSize / 40;
      uniforms.uScanPeriod.value = frame.machineSize / 3;
      uniforms.uReveal.value = 1 - Math.pow(1 - reveal, 3);
      uniforms.uOpacity.value = dim;

      this.#edges.opacity = 0.75 * dim * smoothstep(0, 0.3, reveal) * blink;
      this.#brackets.opacity = dim * smoothstep(0.1, 0.4, reveal) * blink;
    }

    // Gauge, in the parent's frame: turning the joint moves the part, not the plane it turns in.
    // The parent's world rotation is recovered as global × local⁻¹, so the parent is never needed.
    const local = entity.local_transform?.orientation ?? [0, 0, 0, 1];
    localRotation.fromArray(local);
    parentRotation.copy(worldRotation).multiply(localRotation.invert());
    gaugeRotation.copy(parentRotation).multiply(GAUGE_BASIS[info.axis]);

    if (this.#gaugeRadius === 0) {
      this.#gaugeRadius = this.#computeGaugeRadius(
        frame.machineSize,
        worldScale,
      );
    }
    this.#gauge.matrix.compose(
      this.pivot,
      gaugeRotation,
      gaugeScale.setScalar(this.#gaugeRadius),
    );
    this.#gauge.matrixWorldNeedsUpdate = true;

    const angle = twistAngle(local, info.axis);
    const gaugeUniforms = this.#gaugeMaterial.uniforms;
    gaugeUniforms.uAngle.value = THREE.MathUtils.degToRad(angle);
    gaugeUniforms.uTime.value = frame.time + this.#index;
    gaugeUniforms.uOpacity.value = smoothstep(0.35, 0.8, reveal);
  }

  dispose() {
    this.#edges.dispose();
    this.#brackets.dispose();
    (this.#occluder.material as THREE.Material).dispose();
    this.#shellMaterial.dispose();
    this.#gaugeMaterial.dispose();
    this.root.removeFromParent();
  }

  /**
   * Big enough to ring the part where it turns — its extent across the axis — and kept within a
   * readable range of the machine's size. A cylinder turning about its own axis is hugged by it.
   */
  #computeGaugeRadius(machineSize: number, scale: THREE.Vector3) {
    const min = machineSize * 0.035;
    const max = machineSize * 0.11;
    if (!this.#localBox) {
      return machineSize * 0.06;
    }
    const size = this.#shellSize.clone().multiply(scale);
    const axis = AXIS_INDEX[this.info.axis];
    const across = [0, 1, 2]
      .filter((i) => i !== axis)
      .map((i) => size.getComponent(i));
    if (this.shape.kind === "cylinder" && this.shape.axis === this.info.axis) {
      return Math.max(...across) * 0.5 * 1.18;
    }
    return THREE.MathUtils.clamp(0.4 * Math.max(...across), min, max);
  }
}
