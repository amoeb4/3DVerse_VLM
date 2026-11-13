import { cn, Icon } from "@3dverse/ui-lib";
import { Panel, TimeAgo } from "../common";

import {
  formatSignal,
  LAYER_SAMPLES,
  SIGNAL_IDS,
  SIGNALS,
  signalStatus,
  type LayerRecord,
  type SignalId,
} from "../../live/processFeed";
import type { PartMetric } from "./partColors";

const STATUS_STYLE = {
  ok: { text: "text-primary", icon: null },
  idle: { text: "text-secondary", icon: null },
  warn: { text: "text-warning", icon: "fa-triangle-exclamation" },
  alarm: { text: "text-negative", icon: "fa-circle-exclamation" },
} as const;

/** When a sample was laid: along its layer, between the layer's start and end. */
function sampleTime(record: LayerRecord, sample: number) {
  const along = (sample + 0.5) / LAYER_SAMPLES;
  const duration =
    record.endedAt !== null
      ? record.endedAt - record.startedAt
      : (Date.now() - record.startedAt) / Math.max(record.progress, 0.01);
  return record.startedAt + along * duration;
}

/**
 * What was measured at one point of the part: its layer, when it was laid, and every signal there,
 * each against its window, with an icon when out of it. The metric the part is coloured by comes
 * first.
 */
export function PointInspector({
  record,
  sample,
  metric,
  x,
  y,
}: {
  record: LayerRecord;
  sample: number;
  metric: PartMetric;
  /** Where the pointer is, in viewport pixels: the card sits beside it, inside the screen. */
  x: number;
  y: number;
}) {
  const width = 232;
  const height = 230;
  const left = x + 16 + width > window.innerWidth ? x - 16 - width : x + 16;
  const top = Math.min(Math.max(8, y + 16), window.innerHeight - height - 8);
  const order: SignalId[] =
    metric === "deviation"
      ? SIGNAL_IDS
      : [metric, ...SIGNAL_IDS.filter((id) => id !== metric)];

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left, top, width }}
    >
      <Panel
        variant="glass"
        className="px-3 py-2 shadow-[0_0_30px_rgba(0,0,0,0.2)]"
      >
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold">Layer {record.layer}</span>
          <span className="text-3xs text-secondary tabular-nums">
            {Math.round(((sample + 0.5) / LAYER_SAMPLES) * 100)} % along ·{" "}
            <TimeAgo at={sampleTime(record, sample)} />
          </span>
        </div>
        <dl className="space-y-0.5 text-2xs">
          {order.map((id) => {
            const raw = record.samples[id][sample];
            const value = Number.isNaN(raw) ? null : raw;
            const style = STATUS_STYLE[signalStatus(id, value)];
            return (
              <div
                key={id}
                className={cn(
                  "flex justify-between gap-2",
                  id === metric && "font-bold",
                )}
              >
                <dt className="text-secondary">{SIGNALS[id].label}</dt>
                <dd className={cn("tabular-nums", style.text)}>
                  {style.icon && (
                    <Icon className={cn("fas mr-1 text-4xs", style.icon)} />
                  )}
                  {formatSignal(id, value)} {SIGNALS[id].unit}
                </dd>
              </div>
            );
          })}
        </dl>
      </Panel>
    </div>
  );
}
