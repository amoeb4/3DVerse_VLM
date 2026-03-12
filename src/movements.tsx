import * as THREE from "three";

export  async function setOrientation(
    instance: any,
    entityId: string,
    axis: 'x' | 'y' | 'z',
    deltaDeg: number
  ) {
    const [fullEntity] = await instance.scene.findEntities({ entity_uuid: entityId });
    if (!fullEntity) return console.warn(`Entité avec UUID ${entityId} introuvable`);

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
