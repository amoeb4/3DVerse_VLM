import { LivelinkContext } from "@3dverse/livelink-react";
import { useContext, useEffect, useState } from "react";
import { Entity } from "@3dverse/livelink";

export function CreateJoints() {
  const { instance } = useContext(LivelinkContext);
  const [roots, setRoots] = useState<Entity[]>([]);
  useEffect(() => {
    console.log("SAMARSH");
    const fetchEntities = async () => {
      if (!instance) return;
      try {
        const foundEntities = await instance.scene.findEntitiesWithComponents({
          mandatory_components: ["local_transform"],
          forbidden_components: [],
        });
        setRoots(foundEntities);
      } catch (err) {
        console.error("❌ Erreur lors de la récupération des entités :", err);
      }
    };
    fetchEntities();
  }, [instance]);
  useEffect(() => {
    if (!instance || roots.length === 0) return;
    const collectAllJoints = async () => {
      for (const root of roots) {
        const joints = await traverseAndCollectJoints(root);
        console.log(
          `🦴 ${joints.length} joints collectés depuis "${root.name || "(sans nom)"}".`,
        );
      }
    };
    collectAllJoints();
  }, [instance, roots]);

  return null;
}

export type JointEntry = { entity: Entity; parent: Entity | null };
export async function traverseAndCollectJoints(
  entity: Entity,
  parent: Entity | null = null,
): Promise<JointEntry[]> {
  const joints: JointEntry[] = [];
  async function traverse(current: Entity, parent: Entity | null) {
    joints.push({ entity: current, parent });
    if (parent) {
      console.log(
        `🔗 Joint : "${parent.name || "(sans nom)"}" -> "${current.name || "(sans nom)"}"`,
      );
    } else {
      console.log(`🌳 Racine : "${current.name || "(sans nom)"}"`);
    }
    const children = await current.getChildren();
    for (const child of children) {
      await traverse(child, current);
    }
  }
  await traverse(entity, parent);
  return joints;
}
