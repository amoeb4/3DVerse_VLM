import { SIGNALS, type SignalId } from "../live/processFeed";
import type { IncidentKind } from "./procedures";

/** The trace shown with an incident: the last 30 s before the stop, one sample every 200 ms. */
export const TRACE_SAMPLES = 150;
export const TRACE_SECONDS = 30;

export type TraceSignal = {
  id: SignalId;
  label: string;
  unit: string;
  /** Oldest first; `NaN` where the signal was off. */
  values: readonly number[];
  band?: readonly [number, number];
  scale: readonly [number, number];
  /** Shown instead of the line when the signal was off throughout. */
  offText: string;
};

/** A small seeded generator, so everyone in the session sees the same simulated trace. */
function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mid = ([low, high]: readonly [number, number]) => (low + high) / 2;
const halfWidth = ([low, high]: readonly [number, number]) => (high - low) / 2;

/**
 * The trace before an incident's stop. SIMULATED, from the incident's kind and seed: the cell's
 * history is not recorded yet. Once it is, this becomes the recorded samples around `openedAt`.
 *
 * - Torch collision: a steady arc, then the contact (the current jumps, the voltage collapses, the
 *   arc crackles), then the stop.
 * - Worn tool: machining, so no arc; the microphone hears the cut get louder as the tool wears.
 * - Other: a steady arc until the operator stops.
 */
export function incidentTrace(kind: IncidentKind, seed: number): TraceSignal[] {
  const next = random(seed);
  const noise = (scale: number) => (next() - 0.5) * 2 * scale;
  const off = () => Array.from({ length: TRACE_SAMPLES }, () => NaN);

  const steady = (id: SignalId, spread: number) =>
    Array.from(
      { length: TRACE_SAMPLES },
      () => mid(SIGNALS[id].band) + noise(halfWidth(SIGNALS[id].band) * spread),
    );

  const signal = (
    id: SignalId,
    values: number[],
    overrides: Partial<TraceSignal> = {},
  ): TraceSignal => ({
    id,
    label: SIGNALS[id].label,
    unit: SIGNALS[id].unit,
    values,
    band: SIGNALS[id].band,
    scale: SIGNALS[id].scale,
    offText: "Arc off",
    ...overrides,
  });

  const stopAt = TRACE_SAMPLES - 4;

  if (kind === "tool-wear") {
    const sound = Array.from({ length: TRACE_SAMPLES }, (_, i) =>
      i >= stopAt ? NaN : 74 + 18 * (i / stopAt) ** 2 + noise(2.5),
    );
    return [
      signal("arcSound", sound, {
        label: "Sound (mic)",
        // No welding window while machining.
        band: undefined,
      }),
      signal("current", off(), { offText: "Arc off: machining" }),
      signal("voltage", off(), { offText: "Arc off: machining" }),
    ];
  }

  const current = steady("current", 0.45);
  const voltage = steady("voltage", 0.4);
  const sound = steady("arcSound", 0.4);
  if (kind === "torch-collision") {
    // Two seconds of contact before the axes stop.
    const contact = stopAt - 10;
    for (let i = contact; i < stopAt; i += 1) {
      const t = (i - contact) / 10;
      current[i] = 200 + 25 * t + noise(6);
      voltage[i] = 19 - 1.8 * t + noise(0.4);
      sound[i] = 93 + 8 * t + noise(2);
    }
  }
  for (let i = stopAt; i < TRACE_SAMPLES; i += 1) {
    current[i] = NaN;
    voltage[i] = NaN;
    sound[i] = NaN;
  }
  return [
    signal("current", current),
    signal("voltage", voltage),
    signal("arcSound", sound),
  ];
}
