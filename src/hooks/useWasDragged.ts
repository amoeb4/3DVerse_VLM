import { useEffect, useRef } from "react";

/** Past this, in CSS pixels, a press that moves is a drag, not a click. */
const DRAG_THRESHOLD = 5;

/**
 * Whether the pointer's last press moved — a drag, e.g. turning the camera — rather than a click.
 * The browser fires `click` on release either way, and the 3D view picks on `click`: read this
 * then, to leave a drag alone. A second finger down (a pinch) counts as a drag too.
 */
export function useWasDragged(threshold = DRAG_THRESHOLD) {
  const wasDragged = useRef(false);

  useEffect(() => {
    let start: { x: number; y: number } | null = null;

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) {
        wasDragged.current = true;
        return;
      }
      start = { x: event.clientX, y: event.clientY };
      wasDragged.current = false;
    };
    const onMove = (event: PointerEvent) => {
      if (!start || wasDragged.current || !event.isPrimary) return;
      const moved = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (moved > threshold) wasDragged.current = true;
    };
    const onUp = (event: PointerEvent) => {
      if (event.isPrimary) start = null;
    };

    // Captured, so the camera controller cannot hide the press from it.
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [threshold]);

  return wasDragged;
}
