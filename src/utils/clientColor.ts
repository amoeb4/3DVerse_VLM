/**
 * Deterministic color per client id, so the same person keeps the same color for the whole
 * session — shared by the 3D avatar, the bubble in the list, and what they pin in Assistance.
 */
export function colorFromClientId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
