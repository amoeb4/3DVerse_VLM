import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { ROLE_PARAM } from "../routing";
import type { AssistRole } from "./procedures";

/**
 * Who this viewer is in Assistance: an operator, unless the URL says `?role=expert` — an expert's
 * invite link carries it, so they come in as one. Nobody is asked: whoever opens the cell is at it.
 * Each viewer has their own.
 */
export function useAssistRole() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role: AssistRole =
    searchParams.get(ROLE_PARAM) === "expert" ? "expert" : "operator";

  /** `expert` writes `?role=expert`; anything else is the operator, the default, and clears it. */
  const setRole = useCallback(
    (next: AssistRole | null) => {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (next === "expert") {
            params.set(ROLE_PARAM, "expert");
          } else {
            params.delete(ROLE_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { role, setRole };
}
