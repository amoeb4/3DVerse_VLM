import { useEffect, useRef } from "react";
import { cn } from "@3dverse/ui-lib";

import type { SignalStatus } from "../../live/processFeed";

const SIZE = 48;
const CENTER = SIZE / 2;
/** The container circle. */
const RADIUS = 22;
/** The wave's half-width, inside the circle, and the height it runs at: above the value. */
const HALF_WIDTH = 16;
const WAVE_Y = CENTER - 4;
/** How far the wave reaches up (and down) at full level. */
const MAX_AMPLITUDE = 7;
const POINTS = 64;
/** How fast the wave follows the level: quick to rise, like a sound. */
const RESPONSE_S = 0.12;

const RING_COLOR: Record<SignalStatus, string> = {
  ok: "text-accent-300",
  warn: "text-warning",
  alarm: "text-negative",
  idle: "text-secondary",
};

/**
 * A sound wave across the circle: a flat line while quiet, a wave that grows and quickens with the
 * level. Sums a few sines, each at its own speed, so it keeps changing shape instead of just
 * scrolling, and fades it to nothing at both ends, so it starts and ends on the line.
 */
function wavePath(level: number, phase: number) {
  const amplitude = MAX_AMPLITUDE * level;
  let d = "";
  for (let i = 0; i <= POINTS; i += 1) {
    const t = i / POINTS;
    const envelope = Math.sin(Math.PI * t) ** 2;
    const angle = t * Math.PI * 2;
    const wave =
      0.55 * Math.sin(3 * angle + phase) +
      0.3 * Math.sin(5 * angle - 1.6 * phase) +
      0.15 * Math.sin(8 * angle + 2.3 * phase);
    const x = CENTER - HALF_WIDTH + t * 2 * HALF_WIDTH;
    const y = WAVE_Y - amplitude * envelope * wave;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
}

/**
 * The current sound level as a round meter: a wave line across a circle, like the sparkline's but
 * bigger, the value and its unit under it, coloured by its status. `level` is in `unit` on the `min`–`max`
 * scale; `null` (the arc is off) leaves a flat line. Animated outside React, frame by frame; still,
 * but still showing the level, with reduced motion.
 */
export function SoundRing({
  level,
  min,
  max,
  unit,
  status,
  label,
  className,
}: {
  level: number | null;
  min: number;
  max: number;
  unit: string;
  status: SignalStatus;
  label: string;
  className?: string;
}) {
  const waveRef = useRef<SVGPathElement>(null);
  const echoRef = useRef<SVGPathElement>(null);
  const target = useRef(0);
  const reducedMotion = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const normalized =
    level === null ? 0 : Math.min(1, Math.max(0, (level - min) / (max - min)));

  useEffect(() => {
    target.current = normalized;
    if (reducedMotion.current) {
      waveRef.current?.setAttribute("d", wavePath(normalized, 0));
      echoRef.current?.setAttribute("d", wavePath(normalized * 0.6, 1));
    }
  }, [normalized]);

  useEffect(() => {
    if (reducedMotion.current) {
      return;
    }
    let frame = 0;
    let shown = target.current;
    let phase = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      shown += (target.current - shown) * (1 - Math.exp(-dt / RESPONSE_S));
      // Louder is faster, as well as taller.
      phase += dt * (1.5 + 7 * shown);
      waveRef.current?.setAttribute("d", wavePath(shown, phase));
      echoRef.current?.setAttribute(
        "d",
        wavePath(shown * 0.6, -phase * 0.8 + 1),
      );
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn("relative shrink-0", RING_COLOR[status], className)}
      style={{ width: SIZE, height: SIZE }}
      role="meter"
      aria-label={label}
      aria-valuenow={level ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={
        level === null ? "silent" : `${Math.round(level)} ${unit}`
      }
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full overflow-visible [filter:drop-shadow(0_0_3px_currentColor)]"
        aria-hidden
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        <path
          ref={echoRef}
          d={wavePath(normalized * 0.6, 1)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          ref={waveRef}
          d={wavePath(normalized, 0)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute inset-x-0 bottom-1 text-center text-4xs font-bold leading-none tabular-nums text-primary">
        {level === null ? (
          "—"
        ) : (
          <>
            {Math.round(level)}
            <span className="ml-px text-5xs font-normal text-secondary">
              {unit}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
