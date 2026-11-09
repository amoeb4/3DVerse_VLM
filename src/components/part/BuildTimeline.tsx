import { useMemo, useRef } from "react";
import { cn } from "@3dverse/ui-lib";

import {
  LAYER_SAMPLES,
  PLANNED_LAYER_S,
  SIGNAL_IDS,
  signalStatus,
  type BuildRecord,
  type LayerRecord,
} from "../../live/processFeed";
import { STATUS_COLORS, windowPosition } from "./partColors";

/** A layer's worst moment against the WPS windows: 0 in the middle, 1 at the edge, 2 far out. */
type LayerDeviation = { deviation: number; status: "ok" | "warn" | "alarm" };

/** Where the deviation sits in the bar, in % of its height from the top: 0 low, 2 high. */
const deviationY = (deviation: number) =>
  88 - (Math.min(2, deviation) / 2) * 74;

const formatDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
};

/**
 * Part mode's scrubber, which is three things at once:
 * - a progress bar: it spans the whole build as planned (every layer at 100 % feed), and what has
 *   been laid fills it;
 * - a history: over what has been laid, the deviation of each layer — its worst moment against the
 *   WPS windows, the measure the "Deviation" colouring and the findings use — with the window's
 *   edge dashed and the layers that left it marked;
 * - a scrubber: drag, click or use the arrow keys to rewind to a layer laid (`onScrub(layer)`);
 *   past the last one, or End, goes back to live (`onScrub(null)`).
 *
 * The values are above the graph: the layer shown, the time into the build against the planned
 * length, and how much is done.
 */
export function BuildTimeline({
  build,
  pinnedLayer,
  focusLayer,
  onScrub,
  className,
}: {
  build: BuildRecord;
  /** The layer rewound to; `null`: live. */
  pinnedLayer: number | null;
  /** The layer ringed on the part (a finding picked). */
  focusLayer: number | null;
  onScrub: (layer: number | null) => void;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);

  const { layers, records } = build;
  const built = records.length;
  const shownLayer = pinnedLayer ?? built;
  const canScrub = built >= 2;

  const deviations = useLayerDeviations(build);

  // Laid so far: the layers done, the one being laid for its share.
  const laid =
    records.reduce((sum, record) => sum + (record?.progress ?? 0), 0) /
    Math.max(1, layers);
  const completion = Math.floor(laid * 100);
  // Where the cursor stands: the end of the layer shown, or the front of the build, live.
  const cursor = pinnedLayer === null ? laid : shownLayer / layers;

  // Time into the build at the layer shown, against the plan.
  const first = records[0];
  const shown = records[shownLayer - 1];
  const intoBuildS =
    first && shown
      ? ((shown.endedAt ?? Date.now()) - first.startedAt) / 1000
      : 0;
  const plannedS = layers * PLANNED_LAYER_S;

  // The deviation line over the layers laid, x at each layer's middle, in a 1000 × 100 box.
  const line = useMemo(() => {
    const points: string[] = [];
    deviations.forEach((entry, index) => {
      if (!entry) return;
      const x = ((index + 0.5) / layers) * 1000;
      points.push(`${x.toFixed(1)},${deviationY(entry.deviation).toFixed(1)}`);
    });
    return points;
  }, [deviations, layers]);

  const scrubAt = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !canScrub) return;
    const { left, width } = bar.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - left) / width));
    const layer = Math.max(1, Math.ceil(fraction * layers));
    onScrub(layer >= built ? null : layer);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!canScrub) return;
    const step = (delta: number) => {
      const next = Math.min(built, Math.max(1, shownLayer + delta));
      onScrub(next >= built ? null : next);
    };
    const handled: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowDown: () => step(-1),
      ArrowRight: () => step(1),
      ArrowUp: () => step(1),
      PageDown: () => step(-10),
      PageUp: () => step(10),
      Home: () => onScrub(1),
      End: () => onScrub(null),
    };
    const action = handled[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const outOfWindow = deviations
    .map((entry, index) => ({ entry, layer: index + 1 }))
    .filter(
      (item): item is { entry: LayerDeviation; layer: number } =>
        !!item.entry && item.entry.status !== "ok",
    );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* The values, above the graph. */}
      <div className="flex items-baseline justify-between gap-3 text-3xs tabular-nums">
        <span className="whitespace-nowrap">
          <span className="text-secondary">Layer </span>
          <b className="text-primary">{Math.max(1, shownLayer)}</b>
          <span className="text-secondary">/{layers}</span>
          {pinnedLayer === null && (
            <span className="ml-1.5 text-accent-300 font-bold">LIVE</span>
          )}
        </span>
        <span className="whitespace-nowrap">
          <b className="text-primary">{formatDuration(intoBuildS)}</b>
          <span className="text-secondary">
            {" "}
            / {formatDuration(plannedS)} planned ·{" "}
          </span>
          <b className="text-primary">{completion} %</b>
        </span>
      </div>
      <div
        ref={barRef}
        role="slider"
        tabIndex={canScrub ? 0 : -1}
        aria-label="Layer shown"
        aria-valuemin={1}
        aria-valuemax={Math.max(1, built)}
        aria-valuenow={Math.max(1, shownLayer)}
        aria-valuetext={
          pinnedLayer === null
            ? `Live, layer ${built} of ${layers}`
            : `Layer ${shownLayer} of ${layers}`
        }
        aria-disabled={!canScrub}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (!canScrub) return;
          isScrubbing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          scrubAt(event.clientX);
        }}
        onPointerMove={(event) => {
          if (isScrubbing.current) scrubAt(event.clientX);
        }}
        onPointerUp={(event) => {
          isScrubbing.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          isScrubbing.current = false;
        }}
        className={cn(
          "relative h-10 rounded-lg border border-tertiary bg-tertiary/10 overflow-hidden select-none touch-none",
          canScrub ? "cursor-ew-resize" : "cursor-default opacity-70",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        {/* Progress: what has been laid of the planned build. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-accent/40 border-r border-accent-300/60"
          style={{ width: `${laid * 100}%` }}
        />

        {/* History: each laid layer's deviation, the WPS window's edge dashed. */}
        <svg
          aria-hidden
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full text-primary/70"
        >
          <line
            x1={0}
            x2={1000}
            y1={deviationY(1)}
            y2={deviationY(1)}
            stroke={STATUS_COLORS.warn}
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          {line.length > 1 && (
            <>
              <polygon
                points={`${line[0].split(",")[0]},100 ${line.join(" ")} ${line[line.length - 1].split(",")[0]},100`}
                fill="currentColor"
                fillOpacity={0.1}
              />
              <polyline
                points={line.join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* The layers that left their window: dots, so they keep their shape however wide the bar. */}
        {outOfWindow.map(({ entry, layer }) => (
          <span
            key={layer}
            aria-hidden
            className={cn(
              "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              layer === focusLayer && "size-2.5 ring-2 ring-white/80",
            )}
            style={{
              left: `${((layer - 0.5) / layers) * 100}%`,
              top: `${deviationY(entry.deviation)}%`,
              background: STATUS_COLORS[entry.status],
            }}
          />
        ))}

        {/* The cursor. */}
        {canScrub && (
          <div
            aria-hidden
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent-300 shadow-[0_0_6px_var(--color-accent)] pointer-events-none"
            style={{ left: `${cursor * 100}%` }}
          >
            <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 size-2 rotate-45 bg-accent-300" />
          </div>
        )}
      </div>
    </div>
  );
}

//------------------------------------------------------------------------------
/** Each laid layer's deviation, recomputed only for the layers whose record changed. */
function useLayerDeviations(build: BuildRecord): (LayerDeviation | null)[] {
  const cache = useRef(
    new Map<number, { version: number; value: LayerDeviation | null }>(),
  );
  return useMemo(
    () =>
      build.records.map((record) => {
        if (!record) return null;
        let entry = cache.current.get(record.layer);
        if (!entry || entry.version !== record.version) {
          entry = { version: record.version, value: deviationOf(record) };
          cache.current.set(record.layer, entry);
        }
        return entry.value;
      }),
    // `version` changes whenever a record does; the records themselves are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [build.version, build.records],
  );
}

function deviationOf(record: LayerRecord): LayerDeviation | null {
  let deviation = -1;
  let status: LayerDeviation["status"] = "ok";
  for (let sample = 0; sample < LAYER_SAMPLES; sample += 1) {
    for (const id of SIGNAL_IDS) {
      const value = record.samples[id][sample];
      if (Number.isNaN(value)) continue;
      deviation = Math.max(deviation, Math.abs(windowPosition(id, value)));
      const s = signalStatus(id, value);
      if (s === "alarm") status = "alarm";
      else if (s === "warn" && status === "ok") status = "warn";
    }
  }
  return deviation < 0 ? null : { deviation, status };
}
