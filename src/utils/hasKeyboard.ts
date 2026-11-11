/**
 * Whether a key can be named to someone: not where the pointer is coarse, a touch screen, which
 * has no keyboard to press it on.
 */
export const hasKeyboard = () =>
  !window.matchMedia("(pointer: coarse)").matches;
