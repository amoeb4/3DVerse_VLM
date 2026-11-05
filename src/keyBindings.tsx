import { useEffect, useContext } from "react";
import { quat, vec3 } from "gl-matrix";
import { LivelinkContext } from "@3dverse/livelink-react";
import { useSpeed } from "./Interface";
import { eulerToQuat2 } from "./utils/angle";

export default function KeyboardHandler() {
  const { instance } = useContext(LivelinkContext);
  const { speed } = useSpeed();

  useEffect(() => {
    if (!instance) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      try {
        const entities = await instance.scene.findEntitiesWithComponents({
          mandatory_components: ["local_transform"],
          forbidden_components: [],
        });
        //if (key === "j") nfoKey(entities);
        if (key === "m") posKey(instance, entities, 10, 10, 10);
        if (key === "r") posKey(instance, entities, 0, 0, 0);
        if (key === "k") oriKey(instance, entities, 10, 10, 10, eulerToQuat2);
        if (key === "l") oriKey(instance, entities, -90, 0, 0, eulerToQuat2);

        const move = (x = 0, y = 0, z = 0) =>
          camKey(instance, entities, x * speed, y * speed, z * speed);

        if (key === "z") move(0, 0, -1);
        if (key === "s") move(0, 0, 1);
        if (key === "q") move(-1, 0, 0);
        if (key === "d") move(1, 0, 0);
        if (key === "+") move(0, 1, 0);
        if (key === "-") move(0, -1, 0);

        const cameraEntities = entities.filter((entity) => {
          const name = entity.name?.toLowerCase?.();
          const type = entity.type?.toLowerCase?.();
          return name === "camera" || type === "camera";
        });
        if (key === "a")
          oriKey(instance, cameraEntities, 0, 2, 0, eulerToQuat2);
        if (key === "e")
          oriKey(instance, cameraEntities, 0, -2, 0, eulerToQuat2);
        if (key === " ") camKey(instance, entities, 0, 0, 0);
      } catch (error) {
        console.error("Erreur lors de la manipulation des entités :", error);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instance, speed]);

  return null;
}
export async function posKey(
  instance: any,
  entities: { id: string }[],
  param1: number,
  param2: number,
  param3: number,
) {
  for (const entity of entities) {
    const [fullEntity] = await instance.scene.findEntities({
      entity_uuid: entity.id,
    });
    if (fullEntity) {
      const [x, y, z] = fullEntity.local_transform.position;
      if (param1 === 0 && param2 === 0 && param3 === 0) {
        fullEntity.local_transform = {
          position: [0, 0, 0] as [number, number, number],
        };
      } else {
        fullEntity.local_transform = {
          position: [x + param1, y + param2, z + param3] as [
            number,
            number,
            number,
          ],
        };
      }
    }
  }
}

export async function oriKey(
  instance: any,
  entities: { id: string }[],
  param1: number,
  param2: number,
  param3: number,
  eulerToQuat: (
    x: number,
    y: number,
    z: number,
  ) => [number, number, number, number],
) {
  for (const entity of entities) {
    const [fullEntity] = await instance.scene.findEntities({
      entity_uuid: entity.id,
    });
    if (fullEntity) {
      const [x, y, z, w] = fullEntity.local_transform.orientation || [
        0, 0, 0, 1,
      ];
      if (param1 === -90 && param2 === 0 && param3 === 0) {
        fullEntity.local_transform = {
          orientation: eulerToQuat(-90, 0, 0),
        };
      } else {
        fullEntity.local_transform = {
          orientation: eulerToQuat(x + param1, y + param2, z + param3),
        };
      }
    }
  }
}

export async function camKey(
  instance: any,
  entities: { id: string }[],
  moveX: number,
  moveY: number,
  moveZ: number,
) {
  for (const entity of entities) {
    const [fullEntity] = await instance.scene.findEntities({
      entity_uuid: entity.id,
    });
    if (!fullEntity) continue;

    const name = fullEntity?.name?.toLowerCase?.();
    const type = fullEntity?.type?.toLowerCase?.();
    const isCamera = name === "camera" || type === "camera";
    if (!isCamera) continue;

    const position = vec3.fromValues(...fullEntity.local_transform.position);
    const orientation = fullEntity.local_transform.orientation || [0, 0, 0, 1];
    const rotationQuat = quat.fromValues(...orientation);

    if (moveX === 0 && moveY === 0 && moveZ === 0) {
      fullEntity.local_transform.position = [200, 86, 30];
      const defaultQuat = quat.create();
      quat.fromEuler(defaultQuat, 3.5, 88, 0);
      fullEntity.local_transform.orientation = [
        defaultQuat[0],
        defaultQuat[1],
        defaultQuat[2],
        defaultQuat[3],
      ];
      continue;
    }

    const localMove = vec3.fromValues(moveX, moveY, moveZ);
    const worldMove = vec3.create();
    vec3.transformQuat(worldMove, localMove, rotationQuat);
    vec3.add(position, position, worldMove);
    fullEntity.local_transform.position = [
      position[0],
      position[1],
      position[2],
    ];
  }
}

export async function setOrientation(
  instance: any,
  entityId: string,
  param1: number,
  param2: number,
  param3: number,
  eulerToQuat: (
    x: number,
    y: number,
    z: number,
  ) => [number, number, number, number],
) {
  const [fullEntity] = await instance.scene.findEntities({
    entity_uuid: entityId,
  });

  if (fullEntity) {
    fullEntity.local_transform = {
      orientation: eulerToQuat(param1, param2, param3),
    };
  }
}
