// useRotateWithSpeed.ts
import { useSpeed } from "./Interface";
import { rotateHierarchyProgressive } from "./partEntitiesContext";
import type { EntityWithParentId } from "./partEntitiesContext";

export const useRotateWithSpeed = (
  entitiesMap: Map<string, EntityWithParentId>,
) => {
  const { speed } = useSpeed();
  const delayMs = Math.max(10, 1000 / speed);
  return (
    entityName: string,
    deltaQuatDeg: [number, number, number],
    stepDeg = 1,
  ) => {
    return rotateHierarchyProgressive(
      entityName,
      deltaQuatDeg,
      entitiesMap,
      delayMs,
      stepDeg,
    );
  };
};
