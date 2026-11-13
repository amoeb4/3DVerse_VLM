import { cn } from "@3dverse/ui-lib";

import { SourceBadge, Row } from "../common";
import { CollapsibleSection } from "../supervision/CollapsibleSection";
import { useProcessFeed, type CnState } from "../../live/processFeed";

const STATE_LABELS: Record<CnState, string> = {
  running: "Running",
  dwell: "Dwell · interpass",
  hold: "Feed hold (NC Stop)",
};

/**
 * The CN's state, a section of the supervision panel in Monitor, folded by default: the program and
 * block running, the feed override and the alarms. Where the Sinumerik's data will show; simulated
 * until it is connected.
 */
export function CnSection() {
  const { source, cn: cnState } = useProcessFeed(500);
  const alarms = cnState.alarms.length;

  return (
    // Folded, an alarm still shows beside the title.
    <CollapsibleSection
      title="CN · Sinumerik"
      aside={
        <span className="inline-flex items-center gap-1.5">
          {alarms > 0 && (
            <span className="text-3xs font-bold text-negative">
              {alarms} {alarms === 1 ? "ALARM" : "ALARMS"}
            </span>
          )}
          <SourceBadge source={source} />
        </span>
      }
    >
      <CnDetails />
    </CollapsibleSection>
  );
}

function CnDetails() {
  const { cn: cnState } = useProcessFeed(500);

  const orientation = "vertical";

  return (
    <div className={cn("grid grid-cols-3 gap-2")}>
      <Row
        label="Program"
        value={<code>{cnState.program}</code>}
        orientation={orientation}
      />
      <Row
        label="Block"
        value={`N${cnState.block}`}
        orientation={orientation}
      />
      <Row
        label="State"
        value={
          <span
            className={cn(
              cnState.state === "hold" && "text-negative font-bold",
              cnState.state === "dwell" && "text-secondary",
            )}
          >
            {STATE_LABELS[cnState.state]}
          </span>
        }
        orientation={orientation}
      />
      <Row
        label="Feed override"
        value={`${cnState.override} %`}
        orientation={orientation}
      />
      <Row
        label="Alarms"
        value={
          cnState.alarms.length > 0 ? (
            <span className="text-negative">{cnState.alarms.join(", ")}</span>
          ) : (
            <span className="text-tertiary">None</span>
          )
        }
        orientation={orientation}
      />
    </div>
  );
}
