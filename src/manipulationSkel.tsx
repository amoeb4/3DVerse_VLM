// import { setOrientation } from "./keyBindings";
import { getDescendants, PartEntitiesContext } from "./partEntitiesContext";
import { Entity } from "@3dverse/livelink";
import { posKey, oriKey } from "./keyBindings.tsx";
import type { EntityWithParentId } from "./partEntitiesContext.tsx";
import { eulerToQuat } from "./Interface.tsx";

export async function moveEntityAndChildren(
  rootName: string,
  delta: [number, number, number],
  entitiesMap: Map<string, EntityWithParentId>,
  instance: any,
) {
  const entitiesArray = [...entitiesMap.values()];
  const rootIndex = entitiesArray.findIndex((e) => e.name === rootName);
  if (rootIndex === -1) {
    console.warn(`❌ Entité ${rootName} non trouvée`);
    return;
  }
  const entitiesToMove = entitiesArray.slice(rootIndex);
  const entityList = entitiesToMove.map((e) => ({ id: e.id }));
  try {
    await posKey(instance, entityList, ...delta);
    //  await oriKey(instance, entityList, delta[0], delta[1], delta[2], eulerToQuat);
    console.log(
      `✅ Déplacement + orientation appliqués à ${entityList.length} entités à partir de l'index ${rootIndex}`,
    );
  } catch (err) {
    console.error("❌ Erreur lors du déplacement avec posKey / oriKey :", err);
  }
}
