import { cn, Panel } from "@3dverse/ui-lib";

import { SourceBadge } from "../common/SourceBadge";
import { useProcessFeed } from "../../live/processFeed";

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

function Item({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="text-secondary">{label}</span>
      <span className="font-bold tabular-nums">{children}</span>
    </span>
  );
}

/**
 * The job in one line: order, part, layer, ETA and what it has used so far. Where production
 * planning (MES/ERP) and the consumption counters will show; simulated until they are connected.
 * `compact` keeps the layer and the ETA, for small screens.
 */
export function ProductionStrip({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { source, job, cn: cnState } = useProcessFeed(1000);
  const progress = (job.layer - 1) / job.layers;

  return (
    <Panel
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-2xs",
        "backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <SourceBadge
        source={source}
        label={
          source === "sim" && !compact ? "Simulated process data" : undefined
        }
      />
      {!compact && (
        <>
          <Item label="Order" className="hidden xl:inline-flex">
            {job.order}
          </Item>
          <Item label="Part">{job.part}</Item>
        </>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-secondary">Layer</span>
        <span className="font-bold tabular-nums">
          {job.layer}/{job.layers}
        </span>
        <span
          className="w-16 h-1 rounded-full bg-tertiary/40 overflow-hidden"
          role="progressbar"
          aria-label="Build progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full bg-accent-300"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      </span>
      <Item label="ETA">
        {job.eta !== null ? (
          formatTime(job.eta)
        ) : (
          <span className="text-negative">
            on hold
            {cnState.heldAt !== null && ` since ${formatTime(cnState.heldAt)}`}
          </span>
        )}
      </Item>
      {!compact && (
        <>
          <Item label="Wire">{job.wireKg.toFixed(2)} kg</Item>
          <Item label="Gas">{Math.round(job.gasL)} L</Item>
          <Item label="Arc energy" className="hidden xl:inline-flex">
            {job.energyKWh.toFixed(2)} kWh
          </Item>
        </>
      )}
    </Panel>
  );
}
