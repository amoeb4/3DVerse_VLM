import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, cn, Icon } from "@3dverse/ui-lib";
import {
  Panel,
  PanelTitle,
  SubTitleSection,
  ButtonGroup,
  SourceBadge,
  BackButton,
  ModeSheet,
  type ModeSheetTab,
} from "../components/common";

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
type SheetTab = "findings" | "actions";

/** Below `lg`: what the right column holds on large screens, in the mode's sheet. */
const SHEET_TABS: ModeSheetTab<SheetTab>[] = [
  { id: "findings", label: "Out of WPS", icon: "fa-triangle-exclamation" },
  { id: "actions", label: "Actions", icon: "fa-hand" },
];

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
   * Large screens: under the app's actions, in the right column (`ViewerRightColumn`), where the
   * layers out of WPS go.
   */
  rightSlot: HTMLElement | null;
  /** The app's toolbar for Part (`PartCameraToolbar`), over the timeline. */
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
  // Below `lg`: which of the two right-hand panels the sheet shows.
  const [sheetTab, setSheetTab] = useState<SheetTab>("findings");

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
          "fixed z-40 top-30 lg:top-28 left-0 w-full md:max-w-96 px-4 flex flex-col gap-2",
          "starting:opacity-0 starting:-translate-y-2 transition-all duration-500",
        )}
      >
        <BackButton
          label="Back to Robot"
          title="Back to the robot: the Monitor mode, the camera on the cell"
          onClick={onBack}
          // Below `lg`, the navbar's Monitor does it.
          className="max-lg:hidden"
        />
        <Panel
          variant="glass"
          className={cn("flex flex-col gap-2.5 px-3 py-2.5")}
        >
          <div className="flex items-center justify-between gap-2">
            <SubTitleSection as="span">Colour by</SubTitleSection>
            <SourceBadge source={build.source} />
          </div>
          <ButtonGroup isAttached className="w-full">
            {PART_METRICS.map(({ id, label, description }) => (
              <Button
                key={id}
                variant="outline"
                size="xs"
                className={cn(
                  // On a phone, the five of them in the panel's width.
                  "grow min-w-0 text-2xs max-sm:px-1",
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

      {/* The bottom stack, at the centre, over the modes, laid out as a column so nothing in it
          overlaps: the toolbar, then the timeline. Only what is in it takes the pointer, not the
          column around. */}
      <div className="fixed z-40 inset-x-4 bottom-navbar flex flex-col items-center gap-2 pointer-events-none *:pointer-events-auto">
        {/* The camera's toolbar; below `lg`, the button of the mode's sheet beside it. */}
        <div className="w-full flex items-center justify-between lg:justify-center gap-2 pointer-events-none! *:pointer-events-auto">
          {!isLargeScreen && (
            <ModeSheet
              label="Part"
              icon="fa-cube"
              tabs={SHEET_TABS}
              tab={sheetTab}
              onTabChange={setSheetTab}
              badge={findings.length}
              inFlow
            >
              {sheetTab === "findings" ? (
                <FindingsPanel
                  findings={findings}
                  built={built}
                  focusLayer={focusLayer}
                  onSelect={selectFinding}
                  className="flex"
                />
              ) : (
                <RemoteActions onOpenAssistance={onOpenAssistance} />
              )}
            </ModeSheet>
          )}
          {toolbar}
        </div>

        {/* The build, layer by layer, the panel's full width: back to live is in its header. */}
        <Panel
          variant="glass"
          className={cn("w-full lg:w-184 max-w-full", "p-2")}
        >
          <BuildTimeline
            build={build}
            pinnedLayer={pinnedLayer}
            focusLayer={focusLayer}
            onScrub={(layer) => {
              setIsPlaying(false);
              setPinnedLayer(layer);
            }}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            play={play}
          />
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
      variant="glass"
      className={cn(
        "flex-col",
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
