import { useEffect, useState } from "react";

import { logEvent } from "./eventLog";

/**
 * The state of the link to the real robot — the WebSocket feed `WebSocketProvider` drives the arm
 * from — for the LIVE badge and the supervision panel.
 *
 * Messages can arrive a hundred times a second, so nothing re-renders per message: components
 * read a snapshot on a timer (`useLiveLink`), and the badge's pulse listens to messages directly
 * (`onLiveMessage`) to animate without React.
 *
 * End-to-end latency is shown when the feed stamps its messages with when the robot state was
 * read: a `ts` field (or `t`, `timestamp`), in Unix milliseconds or seconds. It is only meaningful
 * if the robot side's clock is synced (NTP) with the viewer's.
 */

/**
 * - `connecting`: opening the socket;
 * - `live`: data received within the last `STALE_AFTER_MS`;
 * - `idle`: the socket is open but no data is coming (robot stopped, or the bridge is stuck);
 * - `offline`: the socket is closed.
 */
export type LinkStatus = "connecting" | "live" | "idle" | "offline";

export type LiveLinkSnapshot = {
  status: LinkStatus;
  url: string;
  /** Connection attempts since the last success. */
  attempt: number;
  /** `Date.now()` when the socket opened, while it is open. */
  connectedSince: number | null;
  /** `Date.now()` of the last message ever received. */
  lastMessageAt: number | null;
  /** Messages per second, over the last second. */
  rate: number;
  /** End-to-end latency in ms, smoothed; `null` when the feed carries no timestamps. */
  latencyMs: number | null;
  totalMessages: number;
  /** When a reconnection is scheduled, its `Date.now()`; `null` otherwise. */
  retryAt: number | null;
  /** Whether a lost link can be retried by hand (`reconnectLiveLink`). */
  canRetry: boolean;
};

/** No data for this long and the link is no longer live. */
export const STALE_AFTER_MS = 2000;
/** Timestamps are discarded past this: clocks out of sync, not a real delay. */
const MAX_PLAUSIBLE_LATENCY_MS = 10_000;
const LATENCY_SMOOTHING = 0.1;
const RATE_WINDOW_MS = 1000;

type SocketState = "connecting" | "open" | "closed";

let url = "";
let socketState: SocketState = "connecting";
let attempt = 0;
let connectedSince: number | null = null;
let lastMessageAt: number | null = null;
let totalMessages = 0;
let latencyMs: number | null = null;
let retryAt: number | null = null;
let reconnect: (() => void) | null = null;
let lastStatus: LinkStatus = "connecting";
/** `performance.now()` of recent messages, oldest first. */
const recent: number[] = [];

const statusListeners = new Set<() => void>();
const messageListeners = new Set<() => void>();
let watchdog = 0;

function statusNow(now = Date.now()): LinkStatus {
  switch (socketState) {
    case "connecting":
      return "connecting";
    case "closed":
      return "offline";
    case "open":
      return lastMessageAt !== null && now - lastMessageAt < STALE_AFTER_MS
        ? "live"
        : "idle";
  }
}

/** Logs a status change and tells the subscribers. Called on every transition and by the watchdog. */
function refreshStatus() {
  const status = statusNow();
  if (status === lastStatus) {
    return;
  }
  const previous = lastStatus;
  lastStatus = status;
  if (status === "idle" && previous === "live") {
    logEvent("warn", "link", "No data from the robot for 2 s");
  } else if (status === "live" && previous === "idle") {
    logEvent("ok", "link", "Robot data flowing");
  }
  for (const listener of statusListeners) {
    listener();
  }
}

/** While the socket is open, notices when the data stops — no message will say so. */
function startWatchdog() {
  stopWatchdog();
  watchdog = window.setInterval(refreshStatus, 250);
}

function stopWatchdog() {
  window.clearInterval(watchdog);
  watchdog = 0;
}

//------------------------------------------------------------------------------
// Written by the WebSocket provider.
//------------------------------------------------------------------------------
export const liveLink = {
  connecting(socketUrl: string) {
    url = socketUrl;
    socketState = "connecting";
    attempt += 1;
    retryAt = null;
    logEvent(
      "info",
      "link",
      attempt > 1
        ? `Reconnecting to ${socketUrl} (attempt ${attempt})`
        : `Connecting to ${socketUrl}`,
    );
    refreshStatus();
  },

  opened() {
    socketState = "open";
    attempt = 0;
    connectedSince = Date.now();
    retryAt = null;
    logEvent("ok", "link", "Connected to the robot feed");
    startWatchdog();
    refreshStatus();
  },

  /** One message from the robot, with the time it was read on the robot side if it says. */
  message(sentAt?: number) {
    const now = Date.now();
    const first = lastMessageAt === null;
    lastMessageAt = now;
    totalMessages += 1;

    const tick = performance.now();
    recent.push(tick);
    while (recent.length > 0 && tick - recent[0] > RATE_WINDOW_MS) {
      recent.shift();
    }

    if (sentAt !== undefined) {
      const latency = now - sentAt;
      if (latency >= 0 && latency < MAX_PLAUSIBLE_LATENCY_MS) {
        latencyMs =
          latencyMs === null
            ? latency
            : latencyMs + (latency - latencyMs) * LATENCY_SMOOTHING;
      }
    }

    if (first) {
      logEvent("ok", "link", "First data received from the robot");
    }
    for (const listener of messageListeners) {
      listener();
    }
    if (lastStatus !== "live") {
      refreshStatus();
    }
  },

  /** The socket closed; `retryInMs` when a reconnection is scheduled, `null` when giving up. */
  closed(retryInMs: number | null) {
    const wasOpen = socketState === "open";
    socketState = "closed";
    connectedSince = null;
    latencyMs = null;
    recent.length = 0;
    stopWatchdog();
    retryAt = retryInMs === null ? null : Date.now() + retryInMs;
    if (wasOpen) {
      logEvent("error", "link", "Connection to the robot feed lost");
    }
    logEvent(
      retryInMs === null ? "error" : "warn",
      "link",
      retryInMs === null
        ? "Giving up on the robot feed — retry by hand"
        : `Cannot reach the robot feed, retrying in ${Math.round(retryInMs / 1000)} s`,
    );
    refreshStatus();
  },

  /** What a manual retry does; `null` when there is no provider to do it. */
  setReconnect(handler: (() => void) | null) {
    reconnect = handler;
    refreshStatus();
  },
};

/** Parses a message's timestamp field into Unix ms, if it has one. */
export function messageTimestamp(message: Record<string, unknown>) {
  const raw = message.ts ?? message.t ?? message.timestamp;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  // Seconds rather than milliseconds: before 2001 in ms, after it in s.
  return raw < 1e12 ? raw * 1000 : raw;
}

//------------------------------------------------------------------------------
// Read by the UI.
//------------------------------------------------------------------------------
export function getLiveLinkSnapshot(): LiveLinkSnapshot {
  const tick = performance.now();
  const rate = recent.filter((t) => tick - t <= RATE_WINDOW_MS).length;
  return {
    status: statusNow(),
    url,
    attempt,
    connectedSince,
    lastMessageAt,
    rate: (rate * 1000) / RATE_WINDOW_MS,
    latencyMs,
    totalMessages,
    retryAt,
    canRetry: reconnect !== null && socketState === "closed",
  };
}

/** Tries the link again now, after it has been lost. */
export function reconnectLiveLink() {
  reconnect?.();
}

/** Called on every message; returns the unsubscribe. For animations, not for React state. */
export function onLiveMessage(listener: () => void) {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

/** The link's state, refreshed every `refreshMs` and at once on any status change. */
export function useLiveLink(refreshMs = 500): LiveLinkSnapshot {
  const [snapshot, setSnapshot] = useState(getLiveLinkSnapshot);
  useEffect(() => {
    const update = () => setSnapshot(getLiveLinkSnapshot());
    statusListeners.add(update);
    const timer = window.setInterval(update, refreshMs);
    update();
    return () => {
      statusListeners.delete(update);
      window.clearInterval(timer);
    };
  }, [refreshMs]);
  return snapshot;
}
