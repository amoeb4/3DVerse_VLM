import { cn, Panel } from "@3dverse/ui-lib";

import { PanelTitle } from "../common/PanelTitle";
import { SourceBadge } from "../common/SourceBadge";
import { Sparkline } from "../common/Sparkline";
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
      aria-label="Welding"
      className={cn(
        "flex flex-col backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <header className="flex justify-between items-center gap-2 px-4 py-2 border-b border-tertiary">
        <PanelTitle>Welding</PanelTitle>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-3xs font-bold",
            welds.welding ? "text-accent-300" : "text-secondary",
          )}
        >
          {welds.welding ? "WELDING" : "IDLE"}
          <SourceBadge source="sim" />
        </span>
      </header>
      <div className="px-4 py-3">
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
      </div>
      <div className="px-4 py-2 border-t border-tertiary">
        <SignalRow
          id="ctwd"
          value={process.values.ctwd}
          history={process.history.ctwd}
        />
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xs text-secondary">{label}</span>
      <span className="text-xs font-bold tabular-nums">{value}</span>
    </div>
  );
}
