import { cn, Icon, Panel } from "@3dverse/ui-lib";

import { CAMERA_FEEDS } from "../../config";
import { SourceBadge } from "../common/SourceBadge";
import { Sparkline } from "../common/Sparkline";
import {
  HISTORY_LENGTH,
  SIGNALS,
  signalStatus,
  useProcessFeed,
} from "../../live/processFeed";
import { SIGNAL_LINE_COLOR } from "./signalColors";
import { SoundRing } from "./SoundRing";
import { PanelTitle } from "../common/PanelTitle";

/** The ring's range, in dB: from a quiet cell to well past the arc's window. */
const METER = { min: 50, max: 110 };

/**
 * The cell's sensors for the qualitative analysis: two welding cameras, for a clear view of the arc
 * (strike, crackling, short circuits) and of the weld pool, and the microphone, for the arc's
 * sound and its crackling. The cameras show as "not connected" until their URLs are set (`CAMERA_FEEDS`).
 */
export function SensorTiles({ className }: { className?: string }) {
  const process = useProcessFeed(200);
  return (
    <Panel
      className={cn(
        "flex flex-col gap-2 px-3 py-1.5 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <PanelTitle>Sensors</PanelTitle>
        <SourceBadge source={process.source} />
      </header>
      <div className="grid grid-cols-2 gap-2">
        {CAMERA_FEEDS.map((feed) => (
          <CameraTile key={feed.id} label={feed.label} url={feed.url} />
        ))}
      </div>
      <MicMeter />
    </Panel>
  );
}

function CameraTile({ label, url }: { label: string; url?: string }) {
  return (
    <figure className="relative aspect-video overflow-hidden rounded border border-tertiary bg-ground/70">
      {url ? (
        <img src={url} alt={label} className="size-full object-cover" />
      ) : (
        <div className="size-full grid place-items-center text-tertiary pt-4">
          <Icon className="fas fa-video-slash text-xs" />
        </div>
      )}
      <figcaption className="absolute inset-x-1 top-1 flex items-center justify-between gap-1 text-5xs">
        <span className="truncate text-secondary">{label}</span>
        <SourceBadge
          source={url ? "live" : "none"}
          label={url ? undefined : "OFF"}
        />
      </figcaption>
    </figure>
  );
}

/**
 * The microphone: the arc's sound over the last minute, in decibels, against its window, and its
 * level now, as a ring that ripples with it.
 */
function MicMeter() {
  const process = useProcessFeed(200);
  const level = process.values.arcSound;
  const status = signalStatus("arcSound", level);
  const { band, scale, unit } = SIGNALS.arcSound;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-start gap-1 shrink-0 text-3xs">
        <span className="inline-flex items-center gap-1.5 text-secondary">
          <Icon className="fas fa-microphone" />
          Mic
        </span>
        <span className="text-5xs text-tertiary whitespace-nowrap">
          {unit} · WPS {band[0]}–{band[1]}
        </span>
      </div>
      <Sparkline
        values={process.history.arcSound}
        length={HISTORY_LENGTH}
        min={scale[0]}
        max={scale[1]}
        band={band}
        label={`Arc sound over the last minute, in ${unit}`}
        className={cn("h-10 min-w-0 grow", SIGNAL_LINE_COLOR[status])}
      />
      <SoundRing
        level={level}
        min={METER.min}
        max={METER.max}
        unit={unit}
        status={status}
        label="Arc sound level"
      />
    </div>
  );
}
