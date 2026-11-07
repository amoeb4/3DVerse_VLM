import { useId, type CSSProperties, type Ref } from "react";

import type { JointAxis } from "./joints";

//------------------------------------------------------------------------------
// Geometry, in the units of a 200 × 200 viewBox centred on the pivot.
const ARC_RADIUS = 78;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const TICK_OUTER = 94;
const MINOR_TICK_INNER = 89;
const MAJOR_TICK_INNER = 84;
const INNER_RING_RADIUS = 62;

/** One tick every 5°, a longer one every 30°. Computed once: the bezel never changes. */
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const deg = i * 5;
  const isMajor = deg % 30 === 0;
  const rad = ((deg - 90) * Math.PI) / 180;
  const inner = isMajor ? MAJOR_TICK_INNER : MINOR_TICK_INNER;
  return {
    deg,
    isMajor,
    x1: Math.cos(rad) * inner,
    y1: Math.sin(rad) * inner,
    x2: Math.cos(rad) * TICK_OUTER,
    y2: Math.sin(rad) * TICK_OUTER,
  };
});

// Short, so the gauge eases between streamed values without lagging behind the arm.
const TRANSITION = "120ms linear";

// CSS transforms on SVG elements turn about the user-space origin only when told to — which, with a
// viewBox centred on 0,0, is the pivot.
const ABOUT_PIVOT: CSSProperties = {
  transformBox: "view-box",
  transformOrigin: "0px 0px",
};

//------------------------------------------------------------------------------
/** The design-token axis colour, lifted towards white so it glows on a dark scene. */
const axisColor = (axis: JointAxis) =>
  `color-mix(in srgb, var(--axis-color-${axis}) 70%, white)`;

const formatAngle = (deg: number) =>
  `${deg < 0 ? "−" : "+"}${Math.abs(deg).toFixed(1)}°`;

//------------------------------------------------------------------------------
/**
 * A HUD ring drawn around a pivot: a tick bezel, a zero notch at the top, and an arc from 0° to the
 * joint's current angle — clockwise for positive angles, anticlockwise for negative ones — in the
 * colour of the axis the joint turns about, with a needle at its end and a readout below.
 *
 * The ring is the element's box, so anchoring it at its centre puts the pivot in the middle; the
 * readout hangs below it, outside the box.
 *
 * `ringRef` is the element holding the ring alone, for the caller to lay it in the joint's plane of
 * rotation with a CSS transform every frame — see `JointAnglesOverlay`. The readout is outside it,
 * so it keeps facing the screen and stays legible.
 */
export function JointGauge({
  label,
  axis,
  angle,
  size = 150,
  ringRef,
}: {
  label: string;
  axis: JointAxis;
  angle: number;
  size?: number;
  ringRef?: Ref<HTMLDivElement>;
}) {
  const glowId = useId();
  const fillId = useId();
  const color = axisColor(axis);
  const arcLength = (Math.abs(angle) / 360) * ARC_CIRCUMFERENCE;
  const hasArc = Math.abs(angle) >= 0.1;

  // Positive angles run clockwise from the top; negative ones are mirrored to run anticlockwise.
  const arcStyle: CSSProperties = {
    ...ABOUT_PIVOT,
    stroke: color,
    strokeDasharray: `${arcLength} ${ARC_CIRCUMFERENCE}`,
    transform: angle < 0 ? "rotate(-90deg) scaleY(-1)" : "rotate(-90deg)",
    transition: `stroke-dasharray ${TRANSITION}`,
  };

  return (
    <div
      className="relative pointer-events-none select-none"
      style={{ width: size, height: size }}
    >
      <div ref={ringRef} className="size-full will-change-transform">
        <svg
          viewBox="-100 -100 200 200"
          width={size}
          height={size}
          className="overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={fillId}>
              <stop offset="45%" style={{ stopColor: color, stopOpacity: 0 }} />
              <stop
                offset="100%"
                style={{ stopColor: color, stopOpacity: 0.16 }}
              />
            </radialGradient>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* Faint disc, so the ring reads against a busy model. */}
          <circle r={TICK_OUTER} fill={`url(#${fillId})`} />

          {/* Bezel */}
          {TICKS.map(({ deg, isMajor, x1, y1, x2, y2 }) => (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="white"
              strokeOpacity={isMajor ? 0.55 : 0.22}
              strokeWidth={isMajor ? 1.6 : 0.8}
            />
          ))}

          {/* Zero notch */}
          <path d="M0,-97 L-4.5,-105 L4.5,-105 Z" style={{ fill: color }} />

          {/* Track */}
          <circle
            r={ARC_RADIUS}
            fill="none"
            stroke="white"
            strokeOpacity={0.14}
            strokeWidth={2}
          />

          {/* Inner ring, turning slowly — the "live" cue. Still under reduced motion. */}
          <g
            className="motion-safe:animate-[spin_24s_linear_infinite]"
            style={ABOUT_PIVOT}
          >
            <circle
              r={INNER_RING_RADIUS}
              fill="none"
              stroke="white"
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="2 7"
            />
          </g>

          {/* Angle arc: a blurred copy underneath for the glow, the crisp one on top. */}
          {hasArc && (
            <>
              <circle
                r={ARC_RADIUS}
                fill="none"
                strokeWidth={10}
                strokeOpacity={0.55}
                filter={`url(#${glowId})`}
                style={arcStyle}
              />
              <circle
                r={ARC_RADIUS}
                fill="none"
                strokeWidth={6}
                strokeLinecap="round"
                style={arcStyle}
              />
            </>
          )}

          {/* Needle at the current angle */}
          <g
            style={{
              ...ABOUT_PIVOT,
              transform: `rotate(${angle}deg)`,
              transition: `transform ${TRANSITION}`,
            }}
          >
            <line
              y1={-INNER_RING_RADIUS + 4}
              y2={-TICK_OUTER - 2}
              stroke="white"
              strokeWidth={1.5}
              strokeOpacity={0.9}
            />
            <circle
              cy={-ARC_RADIUS}
              r={5}
              fill="white"
              strokeWidth={2.5}
              style={{ stroke: color }}
            />
          </g>

          {/* Pivot crosshair */}
          <g stroke="white" strokeOpacity={0.6} strokeWidth={1}>
            <line x1={-7} x2={7} />
            <line y1={-7} y2={7} />
          </g>
          <circle r={2.2} fill="white" />
        </svg>
      </div>

      {/* Readout */}
      <div
        data-theme="dark"
        className="absolute left-1/2 top-full -translate-x-1/2 mt-1 flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border whitespace-nowrap"
        style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
      >
        <span
          className="px-1 rounded-sm text-[11px] font-bold uppercase text-black"
          style={{ background: color }}
        >
          {axis}
        </span>
        <span className="text-[12px] uppercase tracking-[0.2em] text-white/70">
          {label}
        </span>
        <span
          className="text-[17px] font-bold tabular-nums text-white"
          style={{
            fontFamily: "ui-monospace, monospace",
            textShadow: `0 0 8px ${color}`,
          }}
        >
          {formatAngle(angle)}
        </span>
      </div>
    </div>
  );
}
