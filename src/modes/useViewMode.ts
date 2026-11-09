import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { MODE_PARAM } from "../routing";
import { DEFAULT_MODE, MODES, parseViewMode, type ViewMode } from "./modes";

/**
 * The viewer's mode, from the URL (`?mode=`), and a way to switch it. Switching replaces the
 * history entry rather than adding one, so Back still leaves the viewer, and keeps the other
 * parameters, `sessionId` first.
 */
export function useViewMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = parseViewMode(searchParams.get(MODE_PARAM));

  const setMode = useCallback(
    (next: ViewMode) => {
      if (!MODES[next].ready) {
        return;
      }
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (next === DEFAULT_MODE) {
            params.delete(MODE_PARAM);
          } else {
            params.set(MODE_PARAM, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { mode, setMode };
}
