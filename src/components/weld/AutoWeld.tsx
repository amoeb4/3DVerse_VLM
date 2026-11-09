import { useEffect } from "react";

import { useArcOn } from "../../live/processFeed";
import { setWelding } from "../../live/weldLog";

/**
 * While the machine is running — its CN laying a layer, the arc on — the weld is on: the arc lights
 * the cell (`WeldArc`) and the bead builds along the torch's path (`WeldBeads`). Off in the dwell
 * between two layers and on hold.
 *
 * It follows the machine's changes only, so Training's Start / Stop Weld still turn the weld on or
 * off by hand until the machine next starts or ends a layer. Every viewer follows the machine, for
 * its own arc effect; only the session's lead writes the weld into the scene (`useWritesWeld`).
 *
 * Mount once, inside `Livelink`, in every mode.
 */
export function AutoWeld() {
  const isArcOn = useArcOn();

  useEffect(() => {
    setWelding(isArcOn, { byMachine: true });
  }, [isArcOn]);

  // Leaving the viewer puts the arc out: the next one starts from the machine's state.
  useEffect(() => () => setWelding(false), []);

  return null;
}
