import { useEffect } from "react";

import { useAssist } from "./assistContext";
import { lastClosedIncident } from "./assistStore";
import { recordIncidentDigest } from "./incidentDigest";

/**
 * Keeps the startup page's tile up to date with what the viewer sees of the machine's incidents:
 * the one open, else the last closed (`incidentDigest.ts`). Nothing seen, nothing recorded, so a
 * session without incidents leaves what an earlier one recorded. Renders nothing; inside
 * `AssistProvider`.
 */
export function IncidentDigestRecorder({ sceneId }: { sceneId: string }) {
  const { incident, snapshot } = useAssist();
  const current = incident ?? lastClosedIncident(snapshot);
  // Recorded again only when it changes: another incident, or this one closed.
  const key = current ? `${current.id}/${current.closed?.at ?? "open"}` : null;

  useEffect(() => {
    if (!current) return;
    recordIncidentDigest(sceneId, {
      kind: current.kind,
      openedAt: current.openedAt,
      closedAt: current.closed?.at ?? null,
      outcome: current.closed?.outcome ?? null,
      seenAt: Date.now(),
    });
    // `key` stands for `current`, which is a new object on every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, key]);

  return null;
}
