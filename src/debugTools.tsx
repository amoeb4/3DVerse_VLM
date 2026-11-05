import type { EntityWithParentId } from "./partEntitiesContext";
import { mat4, vec3, quat } from "gl-matrix";

export function debugEntityTransform(entity: EntityWithParentId, label = "") {
  const pos = vec3.create();
  const rot = quat.create();
  const m = entity.ls_to_ws as mat4;

  mat4.getTranslation(pos, m);
  mat4.getRotation(rot, m);

  console.log(
    `[${label}] ${entity.name}\n` +
      `  ↪ pos: (${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)})\n` +
      `  ↪ rot: (${rot[0].toFixed(3)}, ${rot[1].toFixed(3)}, ${rot[2].toFixed(3)}, ${rot[3].toFixed(3)})`,
  );
}

export function debugDom(entity: EntityWithParentId, label = "") {
  const pos = vec3.create();
  const rot = quat.create();
  const m = entity.ls_to_ws as mat4;

  mat4.getTranslation(pos, m);
  mat4.getRotation(rot, m);

  console.log("avant");
  console.log(`[${label}]`);
  console.log(`[${pos[0].toFixed(3)}]`);
  console.log("après");
}
