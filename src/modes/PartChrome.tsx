import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, cn, Icon, Panel } from "@3dverse/ui-lib";

import { PanelTitle } from "../components/common/PanelTitle";
import { ButtonGroup } from "../components/common/ButtonGroup";
import { SourceBadge } from "../components/common/SourceBadge";
import { BackButton } from "../components/common/BackButton";
import { findingOf, type LayerFinding } from "../components/part/layerFindings";
import {
  legendFor,
  PART_METRICS,
  type Theme,
} from "../components/part/partColors";
import { PartLegend } from "../components/part/PartLegend";
import { BuildTimeline } from "../components/part/BuildTimeline";
import { PointInspector } from "../components/part/PointInspector";
import { RemoteActions } from "../components/monitor/RemoteActions";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { isTypingInField } from "../shortcuts/isTypingInField";
import { SHORTCUTS } from "../shortcuts/shortcuts";
import type { PartViewState } from "./partViewState";
import {
  formatSignal,
  SIGNALS,
  useBuildRecord,
  type BuildRecord,
} from "../live/processFeed";

/** Layers a second while the build replays. */
// "Live" and "Back to Live" share a width, so the bar does not shift when one becomes the other.
const LIVE_BUTTON_WIDTH = "w-32 shrink-0 justify-start gap-2 pl-3 text-white!";

const PLAY_LAYERS_PER_S = 8;

/**
 * Part mode's panels: the part's own digital twin, for a quality or process engineer. Where on the
 * part did the process drift? The part itself is drawn in the cell (`PartInCell`), the camera on it
 * and the arm faded; each bead coloured by what was measured as it was laid. Around it: what it is
 * coloured by, the layers that left their window, a scrubber to rewind the build and replay it, and
 * what was measured at the point under the pointer. Top right, over the layers that left their
 * window: the actions (adjust, stop, assistance). Below `lg`, those two open from the layer bar.
 *
 * `plateMissing`: the machine has no build plate set (`Machine.buildPlate`), so the part cannot be
 * placed in the cell.
 */
export function PartChrome({
  theme,
  state,
  plateMissing = false,
  onOpenAssistance,
  onBack,
  rightSlot,
  toolbar,
}: {
  theme: Theme;
  state: PartViewState;
  plateMissing?: boolean;
  /** To the incident's recovery (`RemoteActions`). */
  onOpenAssistance: () => void;
  /** Back to the robot: the Monitor mode, the camera back on the cell. */
  onBack: () => void;
  /**
   * Large screens: under the app's actions, in the right column (`App`), where the layers out of
   * WPS go.
   */
  rightSlot: HTMLElement | null;
  /** The app's toolbar for Part (the camera on the part or the bead, AR), over the timeline. */
  toolbar?: React.ReactNode;
}) {
  const build = useBuildRecord(500);
  const {
    metric,
    setMetric,
    pinnedLayer,
    setPinnedLayer,
    focusLayer,
    setFocusLayer,
    hover,
  } = state;
  const [isPlaying, setIsPlaying] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  // Below `lg`: which of the two right-hand panels is opened over the layer bar.
  const [sheet, setSheet] = useState<"findings" | "actions" | null>(null);
  const toggleSheet = (panel: "findings" | "actions") =>
    setSheet((open) => (open === panel ? null : panel));

  const built = build.records.length;
  const findings = useFindings(build);

  // The replay: from the first layer to the last laid, then live again.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setPinnedLayer((layer) => {
        const next = (layer ?? 0) + 1;
        if (next >= built) {
          setIsPlaying(false);
          return null;
        }
        return next;
      });
    }, 1000 / PLAY_LAYERS_PER_S);
    return () => window.clearInterval(timer);
  }, [isPlaying, built, setPinnedLayer]);

  // Space: play the build from its first layer, or stop the replay. Captured, so the scene's own
  // space binding (keyBindings.tsx) does not move the camera meanwhile.
  const canPlay = built >= 2;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== SHORTCUTS.playBuild ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingInField(event.target) ||
        !canPlay
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        setFocusLayer(null);
        setPinnedLayer(1);
        setIsPlaying(true);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [canPlay, isPlaying, setFocusLayer, setPinnedLayer]);

  const play = () => {
    setFocusLayer(null);
    setPinnedLayer(1);
    setIsPlaying(true);
  };

  const selectFinding = (finding: LayerFinding) => {
    setIsPlaying(false);
    setFocusLayer((layer) => (layer === finding.layer ? null : finding.layer));
    // Coloured by the signal that left its window, when the part can be; else by the deviation.
    const asMetric = PART_METRICS.find(({ id }) => id === finding.signal);
    setMetric(asMetric ? asMetric.id : "deviation");
  };

  const hovered = hover ? build.records[hover.layer - 1] : undefined;

  return (
    <>
      {/* The left sidebar: back to the robot, then colour by, and the scale. */}
      <div
        className={cn(
          "fixed z-40 top-36 lg:top-28 left-4 w-[calc(100%-2rem)] max-w-96 flex flex-col gap-2",
          "starting:opacity-0 starting:-translate-y-2 transition-all duration-500",
        )}
      >
        <BackButton
          label="Back to Robot"
          title="Back to the robot: the Monitor mode, the camera on the cell"
          onClick={onBack}
        />
        <Panel
          className={cn(
            "flex flex-col gap-2.5 px-3 py-2.5",
            "backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xs font-bold tracking-wider uppercase">
              Colour by
            </span>
            <SourceBadge source={build.source} />
          </div>
          <ButtonGroup isAttached className="w-full">
            {PART_METRICS.map(({ id, label, description }) => (
              <Button
                key={id}
                variant="outline"
                size="xs"
                className={cn(
                  "grow text-2xs",
                  metric === id && "text-accent-300 bg-accent/15",
                )}
                aria-pressed={metric === id}
                title={description}
                onClick={() => setMetric(id)}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
          <PartLegend legend={legendFor(metric, theme)} />
          {plateMissing && (
            <p className="text-2xs text-warning">
              This machine has no build plate set up, so the part cannot be
              placed in the cell.
            </p>
          )}
        </Panel>
      </div>

      {/* Under the app's actions on the right: the layers that left their window, which scroll. */}
      {isLargeScreen &&
        rightSlot &&
        createPortal(
          <FindingsPanel
            findings={findings}
            built={built}
            focusLayer={focusLayer}
            onSelect={selectFinding}
            className="flex min-h-0"
          />,
          rightSlot,
        )}

      {/* The bottom stack, at the centre, laid out as a column so nothing in it overlaps: below
          `lg` the panel opened from the timeline, then the toolbar, then the timeline itself.
          Below `lg`, above the XR toolbar, itself over the modes. Only what is in it takes the
          pointer, not the column around. */}
      <div className="fixed z-40 inset-x-4 bottom-navbar max-lg:bottom-navbar-toolbar flex flex-col items-center gap-2 pointer-events-none *:pointer-events-auto">
        {!isLargeScreen && sheet && (
          <div className="w-full max-h-[40vh] flex flex-col">
            {sheet === "actions" ? (
              <RemoteActions onOpenAssistance={onOpenAssistance} />
            ) : (
              <FindingsPanel
                findings={findings}
                built={built}
                focusLayer={focusLayer}
                onSelect={selectFinding}
                className="flex min-h-0"
              />
            )}
          </div>
        )}

        {toolbar}

        {/* The build, layer by layer. */}
        <Panel
          className={cn(
            "w-full lg:w-[46rem] max-w-full",
            "flex items-center gap-2 px-3 py-2 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            title={
              isPlaying ? "Stop the replay (Space)" : "Replay the build (Space)"
            }
            aria-label={isPlaying ? "Stop the replay" : "Replay the build"}
            onClick={() => (isPlaying ? setIsPlaying(false) : play())}
            disabled={built < 2}
          >
            <Icon
              className={cn("fas text-2xs", isPlaying ? "fa-stop" : "fa-play")}
            />
          </Button>
          <BuildTimeline
            build={build}
            pinnedLayer={pinnedLayer}
            focusLayer={focusLayer}
            onScrub={(layer) => {
              setIsPlaying(false);
              setPinnedLayer(layer);
            }}
            className="grow min-w-0"
          />
          {pinnedLayer === null ? (
            // Live: a quiet indicator, the dot beating while the arc burns.
            <Button
              variant="accent"
              size="sm"
              className={LIVE_BUTTON_WIDTH}
              title="Following the build as it is laid"
              aria-pressed
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  build.arcOn
                    ? "bg-current animate-pulse"
                    : "bg-secondary/60",
                )}
              />
              Live
            </Button>
          ) : (
            // Rewound: the way back stands out.
            <Button
              variant="accent"
              size="sm"
              className={cn(
                LIVE_BUTTON_WIDTH,
                "text-white! whitespace-nowrap shadow-[0_0_14px_var(--color-accent)]",
              )}
              title="Back to the build as it is laid"
              onClick={() => {
                setIsPlaying(false);
                setPinnedLayer(null);
              }}
            >
              <Icon className="fas fa-forward-step text-2xs" />
              Back to Live
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            title="Actions: adjust, stop, assistance"
            aria-label="Actions"
            aria-pressed={sheet === "actions"}
            onClick={() => toggleSheet("actions")}
          >
            <Icon className="fas fa-hand text-2xs" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden relative"
            title="Layers out of WPS"
            aria-label="Layers out of WPS"
            aria-pressed={sheet === "findings"}
            onClick={() => toggleSheet("findings")}
          >
            <Icon className="fas fa-triangle-exclamation text-2xs" />
            {findings.length > 0 && (
              <span className="absolute -top-1 -right-1 text-5xs font-bold tabular-nums">
                {findings.length}
              </span>
            )}
          </Button>
        </Panel>
      </div>

      {hover && hovered && (
        <PointInspector
          record={hovered}
          sample={hover.sample}
          metric={metric}
          x={hover.x}
          y={hover.y}
        />
      )}
    </>
  );
}

//------------------------------------------------------------------------------
/** Each layer's finding, recomputed only for the layers whose record changed. */
function useFindings(build: BuildRecord): LayerFinding[] {
  const cache = useRef(
    new Map<number, { version: number; finding: LayerFinding | null }>(),
  );
  return useMemo(() => {
    const findings: LayerFinding[] = [];
    const seen = new Set<number>();
    build.records.forEach((record) => {
      if (!record) return;
      seen.add(record.layer);
      let entry = cache.current.get(record.layer);
      if (!entry || entry.version !== record.version) {
        entry = { version: record.version, finding: findingOf(record) };
        cache.current.set(record.layer, entry);
      }
      if (entry.finding) findings.push(entry.finding);
    });
    for (const layer of cache.current.keys()) {
      if (!seen.has(layer)) cache.current.delete(layer);
    }
    return findings;
    // `version` changes whenever a record does; the records themselves are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build.version, build.records]);
}

const STATUS = {
  warn: {
    icon: "fa-triangle-exclamation",
    text: "text-warning",
    label: "Out of WPS",
  },
  alarm: {
    icon: "fa-circle-exclamation",
    text: "text-negative",
    label: "Far out of WPS",
  },
} as const;

function FindingsPanel({
  findings,
  built,
  focusLayer,
  onSelect,
  className,
}: {
  findings: LayerFinding[];
  built: number;
  focusLayer: number | null;
  onSelect: (finding: LayerFinding) => void;
  className?: string;
}) {
  return (
    <Panel
      className={cn(
        "flex-col backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        "starting:opacity-0 starting:translate-x-4 transition-all duration-500",
        className,
      )}
    >
      <header className="px-4 py-2 border-b border-tertiary">
        <PanelTitle>Out of WPS</PanelTitle>
        <p className="text-3xs text-secondary">
          {findings.length === 0
            ? `All ${built} layers laid stayed in their window.`
            : `${findings.length} of ${built} layers laid left their window.`}
        </p>
      </header>
      <ol className="min-h-0 overflow-y-auto scroll-fade-y p-1.5 space-y-0.5">
        {[...findings].reverse().map((finding) => {
          const style = STATUS[finding.status];
          const { label, unit } = SIGNALS[finding.signal];
          return (
            <li key={finding.layer}>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-left text-4xs cursor-pointer",
                  "hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-accent",
                  focusLayer === finding.layer && "bg-primary/15",
                )}
                aria-pressed={focusLayer === finding.layer}
                onClick={() => onSelect(finding)}
              >
                <Icon className={cn("fas text-4xs", style.icon, style.text)} />
                <span className="font-bold tabular-nums w-16 shrink-0 whitespace-nowrap">
                  Layer {finding.layer}
                </span>
                <span className="text-secondary truncate">
                  {label} {formatSignal(finding.signal, finding.value)} {unit}
                </span>
                <span className="sr-only">{style.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
