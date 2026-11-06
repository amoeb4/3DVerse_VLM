export const eulerToQuat = (
  x: number,
  y: number,
  z: number,
): [number, number, number, number] => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const c1 = Math.cos(rad(y) / 2),
    s1 = Math.sin(rad(y) / 2);
  const c2 = Math.cos(rad(z) / 2),
    s2 = Math.sin(rad(z) / 2);
  const c3 = Math.cos(rad(x) / 2),
    s3 = Math.sin(rad(x) / 2);
  return [
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * s2 * c3 + s1 * c2 * s3,
    s1 * c2 * c3 - c1 * s2 * s3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ];
};

export const eulerToQuat2 = (x: number, y: number, z: number) => {
  const q = quat.create();
  quat.fromEuler(q, x, y, z);
  return [q[0], q[1], q[2], q[3]] as [number, number, number, number];
};
