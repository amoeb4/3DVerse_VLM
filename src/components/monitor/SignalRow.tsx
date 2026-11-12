import { cn, Icon } from "@3dverse/ui-lib";

import { Sparkline } from "../common/Sparkline";
import {
  formatSignal,
  HISTORY_LENGTH,
  SAMPLE_MS,
  SIGNALS,
  signalStatus,
  type SignalId,
  type SignalStatus,
} from "../../live/processFeed";
import { SIGNAL_LINE_COLOR } from "./signalColors";

const VALUE_COLOR: Record<SignalStatus, string> = {
  ok: "text-primary",
  warn: "text-warning",
  alarm: "text-negative",
  idle: "text-secondary",
};

/** What the feed's history spans, in seconds. */
export const HISTORY_SECONDS = Math.round((HISTORY_LENGTH * SAMPLE_MS) / 1000);

/**
 * One of the process's signals (`SIGNALS`): its name and WPS window, its value now with its unit,
 * and its last minute as a line on its own scale, the window shaded. A value leaving its window
 * turns amber, far out of it red.
 */
export function SignalRow({
  id,
  value,
  history,
  className,
}: {
  id: SignalId;
  /** `null` while the arc is off. */
  value: number | null;
  history: readonly number[];
  className?: string;
}) {
  const { label, unit, band, scale, tooltip } = SIGNALS[id];
  const status = signalStatus(id, value);

  const LabelTag = tooltip ? "abbr" : "span";

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs text-secondary">
          <LabelTag
            className={cn(
              tooltip && "cursor-help underline underline-offset-2",
            )}
            title={tooltip}
          >
            {label}
          </LabelTag>
          <span className="ml-1.5 text-5xs text-tertiary">
            WPS {band[0]}–{band[1]}
          </span>
        </span>
        <span
          className={cn("text-xs font-bold tabular-nums", VALUE_COLOR[status])}
        >
          {status === "alarm" && (
            <Icon className="fas fa-circle-exclamation mr-1 text-3xs" />
          )}
          {formatSignal(id, value)}
          {unit && (
            <span className="ml-1 text-3xs font-normal text-secondary">
              {unit}
            </span>
          )}
        </span>
      </div>
      <Sparkline
        values={history}
        length={HISTORY_LENGTH}
        min={scale[0]}
        max={scale[1]}
        band={band}
        label={`${label} over the last ${HISTORY_SECONDS} seconds`}
        className={cn("h-6 mt-1", SIGNAL_LINE_COLOR[status])}
      />
    </div>
  );
}
