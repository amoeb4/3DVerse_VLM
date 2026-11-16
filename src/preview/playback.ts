import { useSyncExternalStore } from "react";

/** How often what shows the playback (the timeline, the part) hears of it, a second. */
const NOTIFY_HZ = 12;

/**
 * Preview's clock: where the program is, in its own seconds (at its feeds), whether it plays, and
 * how much faster than real time. Outside React, so the frame loop does not re-render the page:
 * `onFrame` is called every frame while playing (the robot), `usePlaybackTick` re-renders a
 * component a dozen times a second (the panels).
 */
export class Playback {
  time = 0;
  duration = 0;
  playing = false;
  speed = 60;

  readonly #listeners = new Set<() => void>();
  readonly #frameListeners = new Set<(time: number) => void>();
  readonly #endListeners = new Set<() => void>();
  #tick = 0;
  #frame = 0;
  #last = 0;
  #notifiedAt = 0;

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getTick = () => this.#tick;

  /** Every frame the time moves, and on every seek. */
  onFrame(listener: (time: number) => void) {
    this.#frameListeners.add(listener);
    return () => {
      this.#frameListeners.delete(listener);
    };
  }

  /** When playing reaches the end of the program (not on a seek to it). */
  onEnded(listener: () => void) {
    this.#endListeners.add(listener);
    return () => {
      this.#endListeners.delete(listener);
    };
  }

  reset(duration: number) {
    this.pause();
    this.duration = duration;
    this.time = 0;
    this.#moved(true);
  }

  seek(time: number) {
    this.time = Math.min(this.duration, Math.max(0, time));
    this.#moved(true);
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.#notify();
  }

  play() {
    if (this.playing || this.duration <= 0) return;
    // From the start again, once at the end.
    if (this.time >= this.duration) this.time = 0;
    this.playing = true;
    this.#last = performance.now();
    this.#frame = requestAnimationFrame(this.#step);
    this.#notify();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.#frame);
    this.#notify();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  #step = (now: number) => {
    // A tab in the background: no catching up with all it missed at once.
    const dt = Math.min(0.25, (now - this.#last) / 1000);
    this.#last = now;
    this.time = Math.min(this.duration, this.time + dt * this.speed);
    const ended = this.time >= this.duration;
    if (ended) this.playing = false;
    this.#moved(ended);
    if (!ended) this.#frame = requestAnimationFrame(this.#step);
    else for (const listener of this.#endListeners) listener();
  };

  #moved(force: boolean) {
    for (const listener of this.#frameListeners) listener(this.time);
    const now = performance.now();
    if (force || now - this.#notifiedAt > 1000 / NOTIFY_HZ) {
      this.#notify();
    }
  }

  #notify() {
    this.#notifiedAt = performance.now();
    this.#tick += 1;
    for (const listener of this.#listeners) listener();
  }
}

/** Re-renders with the playback, a dozen times a second at most. */
export function usePlaybackTick(playback: Playback): number {
  return useSyncExternalStore(playback.subscribe, playback.getTick);
}
