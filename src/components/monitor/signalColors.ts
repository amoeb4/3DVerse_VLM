import type { SignalStatus } from "../../live/processFeed";

/** A signal's chart line, by status: the process panel's charts and the mic's history. */
export const SIGNAL_LINE_COLOR: Record<SignalStatus, string> = {
  ok: "text-accent-300",
  warn: "text-warning",
  alarm: "text-negative",
  idle: "text-secondary",
};
