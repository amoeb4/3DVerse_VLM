import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Entity, Scene } from "@3dverse/livelink";

import { loadMeshAsset, submeshGeometry } from "../holo/meshAssets";

/** One of the arm's axes and all its geometry, merged in the axis's own space. */
export type ArmPiece = { joint: Entity; geometry: THREE.BufferGeometry };

const JOINT_NAME = /^part_(\d+)$/;
/** The axes that make up the arm (the positioner's are `part_7` and `part_8`). */
export const isArmJoint = (index: number) => index >= 1 && index <= 6;

/** The axis an entity moves with: its nearest `part_N` ancestor, itself included. */
function jointOf(entity: Entity): Entity | null {
  let current: Entity | null = entity;
  for (let depth = 0; current && depth < 64; depth += 1) {
    if (JOINT_NAME.test(current.name ?? "")) return current;
    current = current.parent;
  }
  return null;
}

/** A piece's submesh, positions only, taken into the axis's space. */
async function pieceGeometry(entity: Entity, toJoint: THREE.Matrix4) {
  const ref = entity.mesh_ref;
  if (!ref?.value) return null;
  try {
    const asset = await loadMeshAsset(ref.value);
    const submesh = submeshGeometry(asset, ref.submeshIndex ?? 0);
    if (!submesh) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", submesh.getAttribute("position").clone());
    if (submesh.index) geometry.setIndex(submesh.index.clone());
    return geometry.applyMatrix4(
      new THREE.Matrix4().fromArray(entity.ls_to_ws).premultiply(toJoint),
    );
  } catch {
    return null;
  }
}

/**
 * The robot arm's geometry, one merged piece per axis, wrist and torch included: for the part in
 * construction to be hidden where the arm passes in front of it, or for the arm to be veiled.
 * Fetched once from the 3dverse API (the same mesh assets the HUD uses), measured where the axes
 * stand now: each piece is rigid with its axis.
 */
export async function loadArmPieces(scene: Scene): Promise<ArmPiece[]> {
  // Every entity, not only the meshes: their ancestors must be known to find their axes.
  const entities = await scene.findEntitiesWithComponents({
    mandatory_components: ["local_transform"],
    forbidden_components: [],
  });
  const byJoint = new Map<Entity, Entity[]>();
  for (const entity of entities) {
    if (!entity.mesh_ref?.value) continue;
    const joint = jointOf(entity);
    const index = joint ? Number(JOINT_NAME.exec(joint.name ?? "")?.[1]) : NaN;
    if (!joint || !isArmJoint(index)) continue;
    const list = byJoint.get(joint) ?? [];
    list.push(entity);
    byJoint.set(joint, list);
  }

  const pieces = await Promise.all(
    [...byJoint].map(async ([joint, meshes]) => {
      const toJoint = new THREE.Matrix4().fromArray(joint.ws_to_ls);
      let geometries = (
        await Promise.all(meshes.map((mesh) => pieceGeometry(mesh, toJoint)))
      ).filter(
        (g: THREE.BufferGeometry | null): g is THREE.BufferGeometry =>
          g !== null,
      );
      if (geometries.length === 0) return null;
      // Merging needs them all indexed, or none.
      if (!geometries.every((g: THREE.BufferGeometry) => g.index)) {
        geometries = geometries.map((g: THREE.BufferGeometry) =>
          g.index ? g.toNonIndexed() : g,
        );
      }
      const merged =
        geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
      if (geometries.length > 1) {
        geometries.forEach((g: THREE.BufferGeometry) => g.dispose());
      }
      return merged ? { joint, geometry: merged } : null;
    }),
  );
  return pieces.filter((piece): piece is ArmPiece => piece !== null);
}
