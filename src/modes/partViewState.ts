import { useCallback, useState } from "react";

import type { PartMetric } from "../components/part/partColors";
import type { PartHit } from "../components/part/PartInCell";

/**
 * What the Part mode shows, shared by its panels (`PartChrome`) and the part in the cell
 * (`PartInCell`): the metric the part is coloured by, the layer it is rewound to (`null`: the whole
 * build, live), the layer ringed, the point under the pointer, a signal that brings the camera
 * back to the part, and whether the camera is in close-up on the point being welded.
 */
export function usePartViewState() {
  const [metric, setMetric] = useState<PartMetric>("temperature");
  const [pinnedLayer, setPinnedLayer] = useState<number | null>(null);
  const [focusLayer, setFocusLayer] = useState<number | null>(null);
  const [hover, setHover] = useState<PartHit | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  // Close up on the point being welded, the camera turning around it and following it.
  const [closeUp, setCloseUp] = useState(false);
  // Back to the whole part, out of close-up.
  const refocus = useCallback(() => {
    setCloseUp(false);
    setFocusSignal((n) => n + 1);
  }, []);
  return {
    metric,
    setMetric,
    pinnedLayer,
    setPinnedLayer,
    focusLayer,
    setFocusLayer,
    hover,
    setHover,
    focusSignal,
    refocus,
    closeUp,
    setCloseUp,
  };
}

export type PartViewState = ReturnType<typeof usePartViewState>;
