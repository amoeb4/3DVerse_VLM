import { useEffect } from "react";

/**
 * A page that fills the screen and never scrolls: no page scrolling past it, no rubber band on
 * touch screens. The body is put back as it was once the component is gone.
 */
export function useLockBodyScroll() {
  useEffect(() => {
    const { style } = document.body;
    const previous = {
      overflow: style.overflow,
      overscrollBehavior: style.overscrollBehavior,
    };
    style.overflow = "hidden";
    style.overscrollBehavior = "none";
    window.scrollTo(0, 0);
    return () => {
      style.overflow = previous.overflow;
      style.overscrollBehavior = previous.overscrollBehavior;
    };
  }, []);
}
