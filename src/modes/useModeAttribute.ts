import { useEffect } from "react";

import type { ViewMode } from "./modes";

/** The mode on `<html data-mode>`, for the styles that follow it (Training's own accent colour, index.css). */
export function useModeAttribute(mode: ViewMode) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = mode;
    return () => {
      delete root.dataset.mode;
    };
  }, [mode]);
}
