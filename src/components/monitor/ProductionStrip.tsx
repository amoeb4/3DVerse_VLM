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
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 shrink-0 whitespace-nowrap",
        className,
      )}
    >
      <span className="text-secondary">{label}</span>
      <span className="font-bold tabular-nums">{children}</span>
    </span>
  );
}

/**
 * The job in one line: order, part, layer, ETA and what it has used so far. Where production
 * planning (MES/ERP) and the consumption counters will show; simulated until they are connected.
 * `swipeable`, for small screens: all of it on one line, swiped sideways, in place of wrapping and
 * of leaving the order and the arc energy out.
 */
export function ProductionStrip({
  swipeable = false,
  className,
}: {
  swipeable?: boolean;
  className?: string;
}) {
  const { source, job, cn: cnState } = useProcessFeed(1000);
  const progress = (job.layer - 1) / job.layers;
  // Left out between `lg` and `xl`, where the strip would wrap.
  const wideOnly = swipeable ? undefined : "hidden xl:inline-flex";

  return (
    <Panel
      className={cn(
        "flex items-center gap-2 overflow-hidden text-2xs backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <SourceBadge
        source={source}
        label={source === "sim" ? "Simulated process data" : undefined}
        className="ml-2 hidden md:inline-flex"
      />
      <div
        className={cn(
          "flex items-center gap-x-4 px-4 md:px-3 py-3 md:py-1.5",
          swipeable
            ? "overflow-x-auto overscroll-x-contain scroll-fade-x scrollbar-none *:shrink-0"
            : "flex-wrap gap-y-1",
        )}
      >
        <Item label="Order" className={wideOnly}>
          {job.order}
        </Item>
        <Item label="Part">{job.part}</Item>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
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
              {cnState.heldAt !== null &&
                ` since ${formatTime(cnState.heldAt)}`}
            </span>
          )}
        </Item>
        <Item label="Wire">{job.wireKg.toFixed(2)} kg</Item>
        <Item label="Gas">{Math.round(job.gasL)} L</Item>
        <Item label="Arc energy" className={wideOnly}>
          {job.energyKWh.toFixed(2)} kWh
        </Item>
      </div>
    </Panel>
  );
}
