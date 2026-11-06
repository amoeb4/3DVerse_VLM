import * as THREE from "three";
import type { Entity } from "@3dverse/livelink";

import { jointInfoFor } from "../joints/joints";
import { HoloEntity, type FrameContext } from "./HoloEntity";
import { GLOW_RESOLUTION } from "./GlowLines";
import type { HoloShape } from "./holoTags";

/** How deep under a "main" entity to look for meshes that belong to it. */
const MAX_CHILD_DEPTH = 4;

//------------------------------------------------------------------------------
/**
 * The entity's bounding box in its own space: its `local_aabb` merged with those of its children,
 * so a part whose mesh hangs on a child entity still gets one. Children that are "main" entities
 * themselves are parts in their own right, and left out.
 */
export async function collectLocalBox(
  entity: Entity,
  mainIds: Set<string>,
): Promise<THREE.Box3 | null> {
  const box = new THREE.Box3();
  const toLocal = new THREE.Matrix4().fromArray(entity.ws_to_ls);
  const childToLocal = new THREE.Matrix4();
  const corner = new THREE.Vector3();

  const addAabb = (
    aabb: { min: readonly number[]; max: readonly number[] },
    matrix: THREE.Matrix4 | null,
  ) => {
    const { min, max } = aabb;
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? max[0] : min[0],
        i & 2 ? max[1] : min[1],
        i & 4 ? max[2] : min[2],
      );
      box.expandByPoint(matrix ? corner.applyMatrix4(matrix) : corner);
    }
  };

  if (entity.local_aabb) {
    addAabb(entity.local_aabb, null);
  }

  const walk = async (parent: Entity, depth: number) => {
    if (depth > MAX_CHILD_DEPTH) {
      return;
    }
    let children: Entity[] = [];
    try {
      children = await parent.getChildren();
    } catch {
      return;
    }
    for (const child of children) {
      if (mainIds.has(child.id)) {
        continue;
      }
      if (child.local_aabb) {
        childToLocal.fromArray(child.ls_to_ws).premultiply(toLocal);
        addAabb(child.local_aabb, childToLocal);
      }
      await walk(child, depth + 1);
    }
  };
  await walk(entity, 1);

  return box.isEmpty() ? null : box;
}

//------------------------------------------------------------------------------
/**
 * Everything the HUD draws, for one set of "main" entities: a `HoloEntity` per part.
 *
 * The machine's bounds are measured once, on the first frame, and kept: they set the spacing of
 * everything, which must not breathe as the arm moves.
 */
export class HoloStage {
  readonly root = new THREE.Group();
  readonly holograms: HoloEntity[];

  readonly #bounds = new THREE.Box3();
  #size = 0;
  #measured = false;

  constructor(holograms: HoloEntity[]) {
    this.holograms = holograms;
    for (const holo of holograms) {
      this.root.add(holo.root);
    }
  }

  static async create(parts: { entity: Entity; shape: HoloShape }[]) {
    const mainIds = new Set(parts.map(({ entity }) => entity.id));
    const boxes = await Promise.all(
      parts.map(({ entity }) => collectLocalBox(entity, mainIds)),
    );
    return new HoloStage(
      parts.map(
        ({ entity, shape }, index) =>
          new HoloEntity({
            entity,
            info: jointInfoFor(entity),
            index,
            shape,
            localBox: boxes[index],
          }),
      ),
    );
  }

  update({
    time,
    introTime,
    viewportWidth,
    viewportHeight,
  }: {
    time: number;
    introTime: number;
    viewportWidth: number;
    viewportHeight: number;
  }) {
    GLOW_RESOLUTION.value.set(viewportWidth, viewportHeight);
    if (!this.#measured) {
      this.#measure();
    }

    const frame: FrameContext = {
      time,
      introTime,
      machineSize: this.#size,
    };
    for (const holo of this.holograms) {
      holo.update(frame);
    }
  }

  dispose() {
    for (const holo of this.holograms) {
      holo.dispose();
    }
    this.root.removeFromParent();
  }

  #measure() {
    // Pivots first: the boxes' containment test below needs them where the entities are now.
    for (const holo of this.holograms) {
      holo.syncPivot();
    }

    this.#bounds.makeEmpty();
    for (const holo of this.holograms) {
      holo.expandBox(this.#bounds);
    }
    if (this.#bounds.isEmpty()) {
      return;
    }
    const extent = this.#bounds.getSize(new THREE.Vector3());
    this.#size = Math.max(extent.length(), 1e-3);

    // A box holding the pivots of several other parts is the bounds of a whole sub-assembly rather
    // than of one part: as an occluder it would hide everything inside it.
    for (const holo of this.holograms) {
      const enclosed = this.holograms.filter(
        (other) => other !== holo && holo.containsPoint(other.pivot),
      ).length;
      holo.occludes = enclosed < 2;
    }

    this.#measured = true;
  }
}
