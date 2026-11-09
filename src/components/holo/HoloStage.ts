import * as THREE from "three";
import type { Entity } from "@3dverse/livelink";

import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { jointInfoFor } from "../joints/joints";
import { HoloEntity, type FrameContext, type PartMesh } from "./HoloEntity";
import { loadMeshAsset, submeshGeometry } from "./meshAssets";
import { GLOW_RESOLUTION } from "./GlowLines";
import type { HoloShape } from "./holoTags";

/** How deep under a "hud" entity to look for meshes that belong to it. */
const MAX_CHILD_DEPTH = 4;

//------------------------------------------------------------------------------
/** An entity making up a part, and the matrix taking its space into the part's (none for the part). */
export type Piece = { entity: Entity; toPart: THREE.Matrix4 | null };

/**
 * The entities that make up a part: the "hud" entity itself and its children, so a part whose mesh
 * hangs on a child entity is still whole. Children that are "hud" entities themselves are parts
 * in their own right, and left out with everything under them.
 *
 * The children are measured where they stand now, relative to the part: they are rigid with it.
 */
export async function collectPieces(
  entity: Entity,
  mainIds: Set<string>,
): Promise<Piece[]> {
  const pieces: Piece[] = [{ entity, toPart: null }];
  const toPart = new THREE.Matrix4().fromArray(entity.ws_to_ls);

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
      pieces.push({
        entity: child,
        toPart: new THREE.Matrix4()
          .fromArray(child.ls_to_ws)
          .premultiply(toPart),
      });
      await walk(child, depth + 1);
    }
  };
  await walk(entity, 1);
  return pieces;
}

/** The part's bounding box in its own space: the `local_aabb`s of all its pieces, merged. */
export function localBoxOf(pieces: Piece[]): THREE.Box3 | null {
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  for (const { entity, toPart } of pieces) {
    const aabb = entity.local_aabb;
    if (!aabb) {
      continue;
    }
    const { min, max } = aabb;
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? max[0] : min[0],
        i & 2 ? max[1] : min[1],
        i & 4 ? max[2] : min[2],
      );
      box.expandByPoint(toPart ? corner.applyMatrix4(toPart) : corner);
    }
  }
  return box.isEmpty() ? null : box;
}

/** Between two faces meeting at more than this, their shared edge is drawn. In degrees. */
const FEATURE_EDGE_ANGLE = 30;

/**
 * The part's real geometry, fetched from its pieces' mesh assets and merged in the part's own
 * space, with its feature edges (six numbers per segment) for the glowing outline. `null` when
 * none of its pieces has a mesh.
 */
async function buildPartMesh(pieces: Piece[]): Promise<PartMesh | null> {
  const geometries = (
    await Promise.all(
      pieces.map(async ({ entity, toPart }) => {
        const ref = entity.mesh_ref;
        if (!ref?.value) {
          return null;
        }
        const asset = await loadMeshAsset(ref.value);
        const submesh = submeshGeometry(asset, ref.submeshIndex ?? 0);
        if (!submesh) {
          return null;
        }
        const geometry = submesh.clone();
        return toPart ? geometry.applyMatrix4(toPart) : geometry;
      }),
    )
  ).filter(
    (geometry: THREE.BufferGeometry | null): geometry is THREE.BufferGeometry =>
      geometry !== null,
  );

  if (geometries.length === 0) {
    return null;
  }
  const geometry =
    geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
  if (geometries.length > 1) {
    for (const piece of geometries) {
      piece.dispose();
    }
  }
  if (!geometry) {
    return null;
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const edges = new THREE.EdgesGeometry(geometry, FEATURE_EDGE_ANGLE);
  const segments = edges.getAttribute("position").array as Float32Array;
  edges.dispose();
  return { geometry, edges: segments };
}

//------------------------------------------------------------------------------
/**
 * Everything the HUD draws, for one set of "hud" entities: a `HoloEntity` per part.
 *
 * Built from bounding boxes, which are at hand at once; `loadGeometry` then fetches each part's
 * real mesh and swaps it in for its box.
 *
 * The machine's bounds are measured once, on the first frame, and kept: they set the spacing of
 * everything, which must not breathe as the arm moves.
 */
export class HoloStage {
  readonly root = new THREE.Group();
  readonly holograms: HoloEntity[];

  readonly #pieces: Piece[][];
  readonly #bounds = new THREE.Box3();
  #size = 0;
  #measured = false;

  constructor(holograms: HoloEntity[], pieces: Piece[][]) {
    this.holograms = holograms;
    this.#pieces = pieces;
    for (const holo of holograms) {
      this.root.add(holo.root);
    }
  }

  static async create(parts: { entity: Entity; shape: HoloShape }[]) {
    const mainIds = new Set(parts.map(({ entity }) => entity.id));
    const pieces = await Promise.all(
      parts.map(({ entity }) => collectPieces(entity, mainIds)),
    );
    return new HoloStage(
      parts.map(
        ({ entity, shape }, index) =>
          new HoloEntity({
            entity,
            info: jointInfoFor(entity),
            index,
            shape,
            localBox: localBoxOf(pieces[index]),
          }),
      ),
      pieces,
    );
  }

  /**
   * Fetches every part's real geometry and hands it to its hologram, which scans it in over its
   * box. A part whose mesh cannot be had keeps its box. Resolves once every part is settled.
   */
  async loadGeometry() {
    const results = await Promise.allSettled(
      this.holograms.map(async (holo, index) => {
        const mesh = await buildPartMesh(this.#pieces[index]);
        if (mesh) {
          holo.attachMesh(mesh);
        }
      }),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) {
      console.warn(
        "HoloHud: cannot load the parts' geometry, keeping their boxes",
        failure.reason,
      );
    }
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
