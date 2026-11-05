import type { EntityCore } from "@3dverse/livelink";

export async function updateMaterialInput(
  instance: any,
  entity: EntityCore | undefined,
  param: string,
  value: number,
) {
  if (!instance || !entity) {
    console.warn("Instance ou entité manquante");
    return;
  }

  if (!entity.material) {
    console.warn("L'entité ne contient pas de composant 'material'");
    return;
  }

  const updatedMaterial = {
    ...entity.material,
    dataJSON: {
      ...entity.material.dataJSON,
      [param]: value,
    },
  };

  try {
    await instance.scene.setComponent(entity.euid, "material", updatedMaterial);
    console.log(`✅ Matériau mis à jour : ${param} = ${value}`);
  } catch (err) {
    console.error("Erreur lors de la mise à jour du matériau :", err);
  }
}
