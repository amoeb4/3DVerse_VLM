/**
 * A short buzz under the finger, as an action lands (from 3dverse-mobile-viewer's utils/haptics.ts).
 *
 * The Vibration API is Android-only (no iOS Safari, no desktop browser), so this is a best-effort
 * nicety, not something callers should branch on.
 */
export function triggerHapticFeedback(pattern: number | number[] = 10) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

/** For an action that stops the machine: longer, twice, unlike any other. */
export const HAPTIC_STOP = [40, 60, 40];
