import { useEffect, useRef } from "react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import {
  onLiveMessage,
  reconnectLiveLink,
  useLiveLink,
  type LinkStatus,
} from "../live/liveLink";
import { formatRelative } from "../live/format";

/** The dot beats at most this often, so a fast feed reads as a calm heartbeat, not a flicker. */
const PULSE_INTERVAL_MS = 1600;
/** One beat: the ring widening and fading. */
const PULSE_DURATION_MS = 1200;

const LABELS: Record<LinkStatus, string> = {
  live: "LIVE",
  idle: "NO DATA",
  connecting: "CONNECTING",
  offline: "OFFLINE",
};

/**
 * Says whether what is on screen is the real robot, now: `● LIVE` while its data flows, with the
 * feed's rate and, when the feed is timestamped, its end-to-end latency. The dot beats with the
 * incoming messages, so it stops the moment they do — something a canned animation cannot fake.
 *
 * `collapsible`: the dot alone while its container (`@container`) is narrower than `xl`, the
 * viewer's header on a phone. The label stays there for screen readers.
 *
 * `size`: `sm` is the compact style of `SourceBadge`, for a panel's title row.
 */
export function LiveBadge({
  className,
  showDetail = true,
  collapsible = false,
  size = "md",
}: {
  className?: string;
  showDetail?: boolean;
  collapsible?: boolean;
  size?: "md" | "sm";
}) {
  const isSmall = size === "sm";
  const link = useLiveLink(500);
  const dot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let last = 0;
    return onLiveMessage(() => {
      const now = performance.now();
      if (now - last < PULSE_INTERVAL_MS || !dot.current) {
        return;
      }
      last = now;
      dot.current.animate(
        [
          { transform: "scale(1.15)", boxShadow: "0 0 0 0 currentColor" },
          { transform: "scale(1)", boxShadow: "0 0 0 6px transparent" },
        ],
        { duration: PULSE_DURATION_MS, easing: "ease-out" },
      );
    });
  }, []);

  const { status } = link;
  let detail = "";
  if (status === "live") {
    detail = `${Math.round(link.rate)} msg/s`;
    if (link.latencyMs !== null) {
      detail += ` · ${Math.round(link.latencyMs)} ms`;
    }
  } else if (status === "connecting") {
    detail =
      link.attempt > 1
        ? `Waiting for the robot model… · attempt ${link.attempt}`
        : "Waiting for the robot model…";
  } else if (link.retryAt !== null) {
    detail = `Retry in ${Math.max(0, Math.ceil((link.retryAt - Date.now()) / 1000))} s`;
  } else if (link.lastMessageAt !== null) {
    detail = `last ${formatRelative(link.lastMessageAt)}`;
  } else if (status === "idle") {
    detail = "Waiting for the robot…";
  }

  return (
    <>
      <div
        className={cn(
          // Solid and tinted by its state, so it reads over any picture.
          "inline-flex items-center border",
          isSmall
            ? "h-4 gap-1 px-1 rounded-sm text-5xs"
            : cn(
                "min-h-6 rounded-full text-3xs",
                collapsible
                  ? "px-1.5 @xl:gap-2 @xl:pl-2 @xl:pr-3"
                  : "gap-2 pl-2 pr-3",
              ),
          "bg-ground/90 backdrop-blur-xl tabular-nums whitespace-nowrap",
          status === "live" && "border-accent-300/60 bg-accent/20",
          (status === "idle" || status === "connecting") &&
            "border-warning/50 bg-warning/10",
          status === "offline" && "border-secondary",
          className,
        )}
        title={`Robot feed: ${link.url || "not connected yet"} · ${link.totalMessages} messages received`}
      >
        <span
          ref={dot}
          aria-hidden
          className={cn(
            "rounded-full",
            isSmall ? "size-1.5" : "size-2.5",
            status === "live" && "bg-accent-300 text-accent-300/60",
            status === "idle" && "bg-warning",
            status === "connecting" && "bg-warning",
            status === "offline" && "bg-secondary/50",
          )}
        />
        <span
          role="status"
          className={cn(
            "font-bold tracking-wider",
            collapsible && "sr-only @xl:not-sr-only",
            status === "live" && "text-accent-300",
            status === "offline" && "text-secondary",
            status === "connecting" &&
              "shimmer text-warning [--shimmer-color:white]",
          )}
        >
          {LABELS[status]}
        </span>

        {link.canRetry && link.retryAt === null && (
          <Button
            variant="ghost"
            size="icon-xs"
            title="Reconnect to the robot feed"
            onClick={reconnectLiveLink}
            className={cn(
              collapsible ? "@xl:-mr-1.5" : "-mr-1.5",
              isSmall && "size-4 -mr-1",
            )}
          >
            <Icon
              className={cn(
                "fas fa-rotate-right text-5xs",
                isSmall && "text-[8px]",
              )}
            />
          </Button>
        )}
      </div>
      {showDetail && detail && (
        <span
          className={cn(
            "hidden md:block ml-1 text-4xs text-tertiary",
            status === "live" && "w-[10ex] text-right tabular-nums",
          )}
        >
          {detail}
        </span>
      )}
    </>
  );
}
