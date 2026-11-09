import { cn, Icon } from "@3dverse/ui-lib";

import type { Legend } from "./partColors";

/**
 * The colour scale of the part: a ramp with its WPS window marked and its values under it, or the
 * status classes, each with its icon and label so the colour is never read alone.
 */
export function PartLegend({
  legend,
  className,
}: {
  legend: Legend;
  className?: string;
}) {
  if (legend.kind === "classes") {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <span className="text-3xs text-secondary">{legend.title}</span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs">
          {legend.items.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: item.color }}
              />
              <Icon className={cn("fas text-3xs text-secondary", item.icon)} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const [bandStart, bandEnd] = legend.band;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex justify-between text-3xs text-secondary">
        <span>
          {legend.title} ({legend.unit})
        </span>
        {legend.ends && (
          <span>
            {legend.ends[0]} · WPS · {legend.ends[1]}
          </span>
        )}
      </div>
      <div
        className="relative h-2.5 rounded-sm"
        style={{ background: legend.gradient }}
      >
        {/* The WPS window. */}
        <div
          className="absolute inset-y-0 border-x border-primary/70"
          style={{
            left: `${bandStart * 100}%`,
            width: `${(bandEnd - bandStart) * 100}%`,
          }}
        />
      </div>
      <div className="relative h-3 text-5xs text-secondary tabular-nums">
        {legend.ticks.map((tick, index) => (
          <span
            key={tick.label}
            className={cn(
              "absolute top-0",
              index === 0
                ? "left-0"
                : index === legend.ticks.length - 1
                  ? "right-0"
                  : "-translate-x-1/2",
            )}
            style={
              index === 0 || index === legend.ticks.length - 1
                ? undefined
                : { left: `${tick.at * 100}%` }
            }
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
