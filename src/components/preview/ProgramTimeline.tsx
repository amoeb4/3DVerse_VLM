import { useMemo, useRef } from "react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { ButtonGroup } from "../common";
import { STATUS_COLORS } from "../part/partColors";
import { formatClock } from "../../preview/formatClock";
import { pointAt, type MpfProgram } from "../../preview/mpf";
import { usePlaybackTick, type Playback } from "../../preview/playback";
import type { ProgramSolution } from "../../preview/robotPreview";

/** How much faster than the program's own time it plays. */
const PLAYBACK_SPEEDS = [10, 60, 300, 1000] as const;
/** The arc's spans, at most this many drawn on the bar. */
const MAX_SPANS = 600;

/**
 * Preview's timeline: the program from its first move to its last, in its own time (its moves at
 * their feeds). The bar shows where the arc burns, and, once the robot is solved, the moves it
 * cannot reach; drag, click or use the arrow keys to go anywhere in it. Above it: play, how fast,
 * the layer, the time.
 */
export function ProgramTimeline({
  program,
  playback,
  solution,
  className,
}: {
  program: MpfProgram;
  playback: Playback;
  solution: ProgramSolution | null;
  className?: string;
}) {
  usePlaybackTick(playback);
  const barRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);

  const { duration } = program;
  const time = playback.time;
  const { index } = pointAt(program, time);
  const layer = program.layer[index];

  // Where the arc burns, as spans of the bar (0–1), merged so there are not too many.
  const spans = useMemo(() => {
    const out: [number, number][] = [];
    // Closer than this, two spans are one: they would not show apart.
    const gap = 1 / MAX_SPANS / 2;
    for (const { start, end } of program.beads) {
      const from = program.time[start] / duration;
      const to = program.time[end] / duration;
      const last = out[out.length - 1];
      if (last && from - last[1] < gap) last[1] = to;
      else out.push([from, to]);
    }
    return out;
  }, [program, duration]);

  // The moves out of the robot's reach, as ticks.
  const unreachable = useMemo(() => {
    if (!solution || solution.unreachable === 0) return [];
    const ticks = new Set<number>();
    solution.positionError.forEach((mm, i) => {
      if (mm > 0.5 || solution.angleError[i] > 0.5) {
        ticks.add(Math.round((program.time[i] / duration) * 400));
      }
    });
    return [...ticks].map((tick) => tick / 400);
  }, [solution, program, duration]);

  const seekAt = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const { left, width } = bar.getBoundingClientRect();
    playback.seek(
      Math.min(1, Math.max(0, (clientX - left) / width)) * duration,
    );
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = (fraction: number) =>
      playback.seek(time + fraction * duration);
    const handled: Record<string, () => void> = {
      ArrowLeft: () => step(-0.01),
      ArrowDown: () => step(-0.01),
      ArrowRight: () => step(0.01),
      ArrowUp: () => step(0.01),
      PageDown: () => step(-0.1),
      PageUp: () => step(0.1),
      Home: () => playback.seek(0),
      End: () => playback.seek(duration),
    };
    const action = handled[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const fraction = duration > 0 ? time / duration : 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-3xs">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="2xs"
            title={
              playback.playing ? "Pause (Space)" : "Play the program (Space)"
            }
            aria-label={playback.playing ? "Pause" : "Play the program"}
            onClick={() => playback.toggle()}
            className="w-16 justify-start gap-1"
          >
            <Icon
              className={cn(
                "fas text-[9px]",
                playback.playing ? "fa-pause" : "fa-play",
              )}
            />
            {playback.playing ? "Pause" : "Play"}
          </Button>
          <ButtonGroup isAttached>
            {PLAYBACK_SPEEDS.map((speed) => (
              <Button
                key={speed}
                variant="outline"
                size="2xs"
                className={cn(
                  "px-1.5 tabular-nums",
                  playback.speed === speed && "text-accent-300 bg-accent/15",
                )}
                aria-pressed={playback.speed === speed}
                title={`${speed} times faster than the program runs`}
                onClick={() => playback.setSpeed(speed)}
              >
                ×{speed}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <span className="whitespace-nowrap">
          <span className="text-secondary">Layer </span>
          <b className="text-primary tabular-nums">{layer}</b>
          <span className="text-secondary tabular-nums">/{program.layers}</span>
        </span>
        <span className="whitespace-nowrap tabular-nums">
          <b className="text-primary">{formatClock(time)}</b>
          <span className="text-secondary"> / {formatClock(duration)}</span>
        </span>
      </div>

      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Time in the program"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}, layer ${layer} of ${program.layers}`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          isScrubbing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekAt(event.clientX);
        }}
        onPointerMove={(event) => {
          if (isScrubbing.current) seekAt(event.clientX);
        }}
        onPointerUp={(event) => {
          isScrubbing.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          isScrubbing.current = false;
        }}
        className={cn(
          "relative h-8 rounded-lg border border-tertiary bg-tertiary/10 overflow-hidden select-none touch-none cursor-ew-resize",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent",
        )}
      >
        {/* Played so far. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-accent/25"
          style={{ width: `${fraction * 100}%` }}
        />
        {/* Where the arc burns. */}
        <svg
          aria-hidden
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          {spans.map(([from, to], i) => (
            <rect
              key={i}
              x={from * 1000}
              width={Math.max(0.6, (to - from) * 1000)}
              y={38}
              height={24}
              className="fill-accent-300/70"
            />
          ))}
          {unreachable.map((at) => (
            <rect
              key={at}
              x={at * 1000 - 1}
              width={2}
              y={0}
              height={100}
              fill={STATUS_COLORS.alarm}
            />
          ))}
        </svg>
        {/* The cursor. */}
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent-300 shadow-[0_0_6px_var(--color-accent)] pointer-events-none"
          style={{ left: `${fraction * 100}%` }}
        >
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 size-2 rotate-45 bg-accent-300" />
        </div>
      </div>
    </div>
  );
}
