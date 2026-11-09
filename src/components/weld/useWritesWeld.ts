import { useIsSessionLead } from "../../hooks/useIsSessionLead";
import { useWeldState } from "../../live/weldLog";

/**
 * Whether this viewer writes the weld into the shared scene — its beads and the arc's light —
 * rather than only drawing it: while the arc burns, if someone here turned it on (Training's Start
 * Weld), or if the machine did and this viewer leads the session. Every viewer follows the machine,
 * so without the lead the session would get one bead and one light per viewer.
 */
export function useWritesWeld(): boolean {
  const { welding, byMachine } = useWeldState();
  const isLead = useIsSessionLead();
  return welding && (!byMachine || isLead);
}
