// Single source of truth for keyboard shortcuts, so the key handler and the hints shown on the
// buttons (`Kbd`) never drift apart. Same convention as 3dverse-mobile-viewer.
export const SHORTCUTS = {
  // Not "r": keyBindings.tsx already uses it to move every entity back to the origin.
  reset: "p",
  controlPanel: "c",
  // `event.key` is "Escape"; compared lowercased like the others.
  closeControlPanel: "escape",
  theme: "t",
} as const;
