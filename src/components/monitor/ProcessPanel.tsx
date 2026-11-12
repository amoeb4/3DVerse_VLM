import { cn, Panel } from "@3dverse/ui-lib";

import { SourceBadge } from "../common/SourceBadge";
import {
  useProcessFeed,
  type CnState,
  type SignalId,
} from "../../live/processFeed";
import { PanelTitle } from "../common/PanelTitle";
import { HISTORY_SECONDS, SignalRow } from "./SignalRow";

const STATE: Record<CnState, { label: string; className: string }> = {
  running: { label: "ARC ON", className: "text-accent-300" },
  dwell: { label: "DWELL", className: "text-secondary" },
  hold: { label: "HOLD", className: "text-negative" },
};

/**
 * The signals the panel charts, top to bottom. Not all of the feed's: the arc's sound is the
 * microphone's (`SensorTiles`), the stick-out the Welding panel's (`WeldPanel`).
 */
const PANEL_SIGNALS: readonly SignalId[] = [
  "current",
  "voltage",
  "wireSpeed",
  "tcpSpeed",
  "speedRatio",
  "gasFlow",
  "arcEnergy",
  "temperature",
];

/**
 * The process's quantitative indicators: the arc's current and voltage, the wire's speed and the
 * torch's (TCP), the ratio of the two, gas flow, the arc's energy per length and the bead's
 * temperature, each against its WPS window, over the last minute. A value leaving its window turns
 * amber, far out of it red, and the event log says so.
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
          <span className="ml-2 text-5xs font-normal text-secondary">
            last {HISTORY_SECONDS} s
          </span>
        </PanelTitle>
        <span className="inline-flex items-center gap-1.5 text-3xs font-bold">
          <span className={state.className}>{state.label}</span>
          <SourceBadge source={process.source} />
        </span>
      </header>
      <div className="min-h-0 overflow-y-auto scroll-fade-y divide-y divide-tertiary">
        {PANEL_SIGNALS.map((id) => (
          <SignalRow
            key={id}
            className="px-4 py-1.5"
            id={id}
            value={process.values[id]}
            history={process.history[id]}
          />
        ))}
      </div>
    </Panel>
  );
}
