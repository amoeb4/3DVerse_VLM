//------------------------------------------------------------------------------
import { useEffect } from "react";

//------------------------------------------------------------------------------
import { useXRSettingsStore } from "./stores";

//------------------------------------------------------------------------------
// Idle delay before the controls fade out to leave the scene unobstructed.
const HIDDEN_CONTROLS_TIMEOUT_MS = 20000;

//------------------------------------------------------------------------------
/**
 * Fades the HUD controls out after a spell of inactivity, and brings them straight back on the next
 * touch. Writes to `areControlsVisible`, which the XR controls read so they fade together
 * (`XRHud`).
 *
 * @param isPaused Keeps the controls up and the timer off — something is open and being read, or
 *                 the screen is large enough that the fade is not buying any space.
 */
export function useIdleControlsVisibility(isPaused: boolean) {
  //--------------------------------------------------------------------------
  const setAreControlsVisible = useXRSettingsStore(
    (state) => state.setAreControlsVisible,
  );

  //--------------------------------------------------------------------------
  useEffect(() => {
    if (isPaused) {
      setAreControlsVisible(true);
      return;
    }

    let idleTimer = 0;
    // Shown on touch-down and re-armed on touch-up, so the controls are up for the whole of a
    // drag rather than fading back in once it ends.
    const showControls = () => {
      clearTimeout(idleTimer);
      idleTimer = 0;
      setAreControlsVisible(true);
    };
    const restartTimer = () => {
      showControls();
      idleTimer = setTimeout(() => {
        idleTimer = 0;
        setAreControlsVisible(false);
      }, HIDDEN_CONTROLS_TIMEOUT_MS) as unknown as number;
    };

    window.addEventListener("pointerdown", showControls, true);
    window.addEventListener("pointerup", restartTimer, true);
    restartTimer();

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("pointerdown", showControls, true);
      window.removeEventListener("pointerup", restartTimer, true);
    };
  }, [isPaused, setAreControlsVisible]);
}
