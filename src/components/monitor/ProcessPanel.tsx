import { cn, Icon, Panel } from "@3dverse/ui-lib";

import { SourceBadge } from "../common/SourceBadge";
import { Sparkline } from "../common/Sparkline";
import { SIGNAL_LINE_COLOR } from "./signalColors";
import {
  formatSignal,
  HISTORY_LENGTH,
  SAMPLE_MS,
  SIGNAL_IDS,
  SIGNALS,
  signalStatus,
  useProcessFeed,
  type CnState,
  type SignalId,
  type SignalStatus,
} from "../../live/processFeed";
import { PanelTitle } from "../common/PanelTitle";

const VALUE_COLOR: Record<SignalStatus, string> = {
  ok: "text-primary",
  warn: "text-warning",
  alarm: "text-negative",
  idle: "text-secondary",
};

const STATE: Record<CnState, { label: string; className: string }> = {
  running: { label: "ARC ON", className: "text-accent-300" },
  dwell: { label: "DWELL", className: "text-secondary" },
  hold: { label: "HOLD", className: "text-negative" },
};

const HISTORY_SECONDS = Math.round((HISTORY_LENGTH * SAMPLE_MS) / 1000);

/**
 * The process's quantitative indicators: the arc's current and voltage, wire speed, gas flow, the
 * arc's sound and stability, each against its WPS window, over the last minute. A value leaving
 * its window turns amber, far out of it red, and the event log says so.
 */
export function ProcessPanel({ className }: { className?: string }) {
  const process = useProcessFeed(250);
  const state = STATE[process.cn.state];

  return (
    <Panel
      className={cn(
        "flex flex-col backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <header className="flex justify-between items-center gap-2 px-4 py-2 border-b border-tertiary">
        <PanelTitle>
          Process
          <span className="ml-2 text-3xs font-normal text-secondary">
            last {HISTORY_SECONDS} s
          </span>
        </PanelTitle>
        <span className="inline-flex items-center gap-1.5 text-3xs font-bold">
          <SourceBadge source={process.source} />
          <span className={state.className}>{state.label}</span>
        </span>
      </header>
      <div className="min-h-0 overflow-y-auto scroll-fade-y divide-y divide-tertiary">
        {SIGNAL_IDS.map((id) => (
          <SignalRow
            key={id}
            id={id}
            value={process.values[id]}
            history={process.history[id]}
          />
        ))}
      </div>
    </Panel>
  );
}

function SignalRow({
  id,
  value,
  history,
}: {
  id: SignalId;
  value: number | null;
  history: readonly number[];
}) {
  const { label, unit, band, scale } = SIGNALS[id];
  const status = signalStatus(id, value);

  return (
    <div className="px-4 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs text-secondary">
          {label}
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
          <span className="ml-1 text-3xs font-normal text-secondary">
            {unit}
          </span>
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
