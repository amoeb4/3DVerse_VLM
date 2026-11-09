import { useEffect, useState } from "react";

import { formatClock, formatRelative } from "../../live/format";

/**
 * A moment shown as people say it — `just now`, `2 min ago`, the clock time beyond the hour
 * (`formatRelative`) — the exact time in its tooltip. It ticks by itself, every few seconds while
 * the moment is under a minute old, every half-minute after, so "2 min ago" never goes stale.
 */
export function TimeAgo({ at, className }: { at: number; className?: string }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = Date.now() - at < 60_000 ? 5_000 : 30_000;
    const timer = window.setInterval(tick, interval);
    return () => window.clearInterval(timer);
  }, [at]);

  return (
    <time
      dateTime={new Date(at).toISOString()}
      title={formatClock(at)}
      className={className}
    >
      {formatRelative(at, now)}
    </time>
  );
}
