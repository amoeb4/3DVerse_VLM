import { cn } from "@3dverse/ui-lib";

import {
  Panel,
  Stat,
  PanelTitle,
  SectionBody,
  SectionHeader,
  SourceBadge,
  Sparkline,
} from "../common";
import { RECENT_WELDS, useWeldStats } from "../../live/weldLog";
import { formatClock } from "../../live/format";
import { useProcessFeed } from "../../live/processFeed";
import { SignalRow } from "./SignalRow";

/** The temperature scale the weld points are coloured on (`weldBead.tsx`). */
const WELD_SCALE = { min: 0, max: 100 };

/**
 * Monitor's welding: whether the arc burns, the weld points laid in this session (`weldLog`) and the
 * temperature of the last ones; then the stick-out (CTWD), the distance from the torch's tip to
 * the bead under it. The bead is laid while the machine runs (`AutoWeld`), on simulated data for
 * now.
 */
export function WeldPanel({ className }: { className?: string }) {
  const welds = useWeldStats();
  const process = useProcessFeed(250);
  const fmt = (value: number | null) =>
    value === null ? "—" : `${Math.round(value)} °C`;

  return (
    <Panel
      variant="glass"
      aria-label="Welding"
      className={cn("flex flex-col", className)}
    >
      <SectionHeader
        className="border-b border-tertiary"
        aside={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-3xs font-bold",
              welds.welding ? "text-accent-300" : "text-secondary",
            )}
          >
            {welds.welding ? "WELDING" : "IDLE"}
            <SourceBadge source="sim" />
          </span>
        }
      >
        <PanelTitle>Welding</PanelTitle>
      </SectionHeader>
      <SectionBody className="pt-3">
        <div className="grid grid-cols-4 gap-2 mb-2">
          <Stat label="Points" value={welds.count.toLocaleString()} />
          <Stat label="Last" value={fmt(welds.last?.temperature ?? null)} />
          <Stat label="Mean" value={fmt(welds.mean)} />
          <Stat label="Max" value={fmt(welds.max)} />
        </div>
        <Sparkline
          values={welds.recent.map((w) => w.temperature)}
          length={RECENT_WELDS}
          min={WELD_SCALE.min}
          max={WELD_SCALE.max}
          label={`Temperature of the last ${welds.recent.length} weld points`}
          emptyText="No weld points yet"
          className="h-10 text-accent-300"
        />
        {welds.startedAt !== null && (
          <p className="mt-1 text-3xs text-secondary">
            Since {formatClock(welds.startedAt)} · last {RECENT_WELDS} points
          </p>
        )}
      </SectionBody>
      <div className="px-4 pt-2 pb-3 border-t border-tertiary">
        <SignalRow
          id="ctwd"
          value={process.values.ctwd}
          history={process.history.ctwd}
        />
      </div>
    </Panel>
  );
}
