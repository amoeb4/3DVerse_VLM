import { cn } from "@3dverse/ui-lib";

import {
  DATA_SOURCE_DESCRIPTIONS,
  DATA_SOURCE_LABELS,
  type DataSource,
} from "../../live/dataSource";

const STYLES: Record<DataSource, string> = {
  live: "text-accent-300 border-accent/40",
  sim: "text-warning border-warning/50 bg-warning/10",
  replay: "text-informative-500 border-informative-500/40",
  none: "text-tertiary border-tertiary",
};

/**
 * Where a widget's data comes from: `LIVE`, `SIM`, `REPLAY` or `NOT CONNECTED`. `label` replaces
 * the short label, e.g. "Simulated process data" where there is room.
 */
export function SourceBadge({
  source,
  label,
  className,
}: {
  source: DataSource;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-4 px-1.5 rounded-sm border",
        "text-5xs font-bold tracking-wider uppercase whitespace-nowrap",
        STYLES[source],
        className,
      )}
      title={DATA_SOURCE_DESCRIPTIONS[source]}
    >
      {label ?? DATA_SOURCE_LABELS[source]}
    </span>
  );
}
