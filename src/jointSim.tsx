import { useContext, useEffect, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";

export type EntityNode = {
  id: string;
  name: string;
  children: EntityNode[];
};

async function buildHierarchy(
  instance: any,
  entityId: string,
): Promise<EntityNode> {
  const entity = await instance.entities.get(entityId);
  const name = entity.getName() ?? entity.id;
  const childrenIds = entity.getChildren();

  const children: EntityNode[] = [];
  for (const childId of childrenIds) {
    const childNode = await buildHierarchy(instance, childId);
    children.push(childNode);
  }

  return { id: entityId, name, children };
}

export function useEntityHierarchy(rootEntityId?: string) {
  const { instance } = useContext(LivelinkContext);
  const [hierarchy, setHierarchy] = useState<EntityNode | null>(null);

  useEffect(() => {
    if (!instance || !rootEntityId) return;
    buildHierarchy(instance, rootEntityId)
      .then(setHierarchy)
      .catch(console.error);
  }, [instance, rootEntityId]);

  return hierarchy;
}
