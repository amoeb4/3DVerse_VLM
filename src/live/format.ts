/** Wall-clock time, `14:32:07`. */
export function formatClock(at: number) {
  return new Date(at).toLocaleTimeString([], { hour12: false });
}

/** A duration, `45 s`, `12 min 03 s`, `2 h 05 min`. */
export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
  }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/**
 * When something happened, as people say it: `just now`, `42 s ago`, `12 min ago` within the hour,
 * the wall-clock time beyond (`formatClock`). `now` is passed in by whoever re-renders with it.
 */
export function formatRelative(at: number, now: number = Date.now()) {
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 0) {
    return formatClock(at);
  }
  if (seconds < 10) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds} s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  return formatClock(at);
}
