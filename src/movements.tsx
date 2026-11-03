import * as THREE from "three";

export  async function setOrientation(
    instance: any,
    entityId: string,
    axis: 'x' | 'y' | 'z',
    deltaDeg: number
  ) {
    const [fullEntity] = await instance.scene.findEntities({ entity_uuid: entityId });
    if (!fullEntity) return console.warn(`Entité avec UUID ${entityId} introuvable`);

    if (entityId == "91153236-a05e-4127-a1c0-49b5761c41e3" && (axis == "x" || axis == "y"))
      return;
    if (entityId == "ec221ded-08df-4bae-8982-bb47c82a0917" && (axis == "z" || axis == "y"))
      return;
    if (entityId == "32cda313-895a-42e1-a5f6-dd50e398c332" && (axis == "x" || axis == "y"))
      return;
    if (entityId == "96b43de7-3c72-4ae5-8d1f-b2137c50bc61" && (axis == "z" || axis == "x"))
      return;
    if (entityId == "ed84c3ff-3c7f-445a-a1ff-d531c8f47133" && (axis == "x" || axis == "y"))
      return;
    if (entityId == "1274b32e-4d37-41cb-ad2b-0ed4886bf918" && (axis == "z" || axis == "y"))
      return;
    if (entityId == "df0b0b6f-789d-46a4-be69-4def0f8e1494" && (axis == "z" || axis == "x"))
      return;
    if (entityId == "2276b2a3-8a16-4d42-934d-fee7376fab25" && (axis == "z" || axis == "x"))
      return;

    const currentQuat = new THREE.Quaternion(...(fullEntity.local_transform.orientation ?? [0, 0, 0, 1]));
    const deltaEuler =
      axis === 'x'
        ? new THREE.Euler(THREE.MathUtils.degToRad(deltaDeg), 0, 0, 'XYZ'): axis === 'y'
        ? new THREE.Euler(0, THREE.MathUtils.degToRad(deltaDeg), 0, 'XYZ')
        : new THREE.Euler(0, 0, THREE.MathUtils.degToRad(deltaDeg), 'XYZ');
    const deltaQuat = new THREE.Quaternion().setFromEuler(deltaEuler);
    const newQuat = deltaQuat.multiply(currentQuat).normalize();
    fullEntity.local_transform.orientation = [newQuat.x, newQuat.y, newQuat.z, newQuat.w];
}

