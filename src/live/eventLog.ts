import { useSyncExternalStore } from "react";

/**
 * A timestamped log of what happens to the live link, the robot, the welding and the process, and
 * of the remote actions people take, for the supervision panel. Written from anywhere
 * (`logEvent`), read with `useEventLog`.
 */

export type EventLevel = "info" | "ok" | "warn" | "error";
/**
 * `action`: a remote action someone took, e.g. a stop request: the audit trail. `assist`: the
 * assistance session, an incident opened, a step done, a note pinned, by whoever.
 */
export type EventSource =
  "link" | "robot" | "weld" | "process" | "action" | "assist";

export type LiveEvent = {
  id: number;
  /** `Date.now()` when it happened. */
  at: number;
  level: EventLevel;
  source: EventSource;
  text: string;
  /** From a simulation, not the machine: shown with a SIM badge. */
  simulated: boolean;
};

/** Oldest events are dropped past this many. */
const MAX_EVENTS = 200;

let events: readonly LiveEvent[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

export function logEvent(
  level: EventLevel,
  source: EventSource,
  text: string,
  { simulated = false }: { simulated?: boolean } = {},
) {
  const event = {
    id: nextId++,
    at: Date.now(),
    level,
    source,
    text,
    simulated,
  };
  events = [event, ...events].slice(0, MAX_EVENTS);
  for (const listener of listeners) {
    listener();
  }
}

export function clearEvents() {
  events = [];
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every event, newest first. */
export function useEventLog(): readonly LiveEvent[] {
  return useSyncExternalStore(subscribe, () => events);
}
