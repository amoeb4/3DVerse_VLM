import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Every weld point laid in this session, for Monitor's welding panel. Kept as running totals and a
 * short recent history rather than a growing list: auto-weld lays tens of points a second.
 */

export type WeldPoint = {
  /** `Date.now()` when it was laid. */
  at: number;
  temperature: number;
};

export type WeldStats = {
  count: number;
  /** Most recent last. */
  recent: readonly WeldPoint[];
  last: WeldPoint | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  /** `Date.now()` of the first weld point. */
  startedAt: number | null;
  /** Whether auto-weld is on. */
  welding: boolean;
};

/** How many recent points the history keeps — the sparkline's width. */
export const RECENT_WELDS = 120;

let count = 0;
let sum = 0;
let min: number | null = null;
let max: number | null = null;
let startedAt: number | null = null;
let welding = false;
let recent: WeldPoint[] = [];
let version = 0;

export function recordWeld(temperature: number) {
  const point = { at: Date.now(), temperature };
  count += 1;
  sum += temperature;
  min = min === null ? temperature : Math.min(min, temperature);
  max = max === null ? temperature : Math.max(max, temperature);
  startedAt ??= point.at;
  recent = [...recent.slice(-(RECENT_WELDS - 1)), point];
  version += 1;
}

/**
 * - `welding`: whether the arc burns, in this viewer;
 * - `byMachine`: whether the machine turned it on (`AutoWeld`: its CN is laying a layer), rather
 *   than someone here (Training's Start Weld).
 */
export type WeldState = { welding: boolean; byMachine: boolean };

let weldState: WeldState = { welding: false, byMachine: false };

const weldingListeners = new Set<() => void>();

export function setWelding(value: boolean, { byMachine = false } = {}) {
  const next = { welding: value, byMachine: value && byMachine };
  if (
    next.welding === weldState.welding &&
    next.byMachine === weldState.byMachine
  ) {
    return;
  }
  welding = value;
  weldState = next;
  version += 1;
  weldingListeners.forEach((listener) => listener());
}

function subscribeWelding(listener: () => void) {
  weldingListeners.add(listener);
  return () => {
    weldingListeners.delete(listener);
  };
}

/** Whether auto-weld is on, updated the moment it changes (the weld arc effect follows it). */
export function useIsWelding(): boolean {
  return useSyncExternalStore(subscribeWelding, () => welding);
}

/** Whether the arc burns, and who turned it on, updated the moment it changes. */
export function useWeldState(): WeldState {
  return useSyncExternalStore(subscribeWelding, () => weldState);
}

export function resetWeldLog() {
  count = 0;
  sum = 0;
  min = max = startedAt = null;
  recent = [];
  version += 1;
}

function snapshot(): WeldStats {
  return {
    count,
    recent,
    last: recent[recent.length - 1] ?? null,
    min,
    max,
    mean: count > 0 ? sum / count : null,
    startedAt,
    welding,
  };
}

/** The weld totals, refreshed every `refreshMs` when they have changed. */
export function useWeldStats(refreshMs = 250): WeldStats {
  const [stats, setStats] = useState(snapshot);
  useEffect(() => {
    let seen = -1;
    const update = () => {
      if (version !== seen) {
        seen = version;
        setStats(snapshot());
      }
    };
    update();
    const timer = window.setInterval(update, refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);
  return stats;
}
