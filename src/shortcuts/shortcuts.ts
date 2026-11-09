import type { ViewMode } from "../modes/modes";

// Single source of truth for keyboard shortcuts, so the key handler and the hints shown on the
// buttons (`Kbd`) never drift apart. Same convention as 3dverse-mobile-viewer.
export const SHORTCUTS = {
  // Not "r": keyBindings.tsx already uses it to move every entity back to the origin.
  reset: "p",
  theme: "t",
  // Part mode: play the build's replay, or stop it. `event.key` for the space bar is " ".
  playBuild: " ",
} as const;

/**
 * A digit per mode. Digits are free: keyBindings.tsx uses letters, `+`, `-` and space. Part and
 * Assistance keep theirs though they left the navbar; Training keeps 5.
 */
export const MODE_SHORTCUTS: Record<ViewMode, string> = {
  monitor: "1",
  part: "2",
  assistance: "3",
  training: "5",
};
