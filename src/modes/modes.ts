/**
 * The viewer's modes: who is looking at the cell and what for. Each viewer picks their own (it is in
 * their URL, `?mode=`), so in a shared session an expert can watch the process in Monitor while
 * someone else works in Sandbox.
 *
 * The use-cases behind them follow the client's incident loop, Diagnostic ➔ Résolution ➔ Reprise:
 * - Monitor: remote monitoring of the process (process drift, quality indicators, remote actions).
 * - Part: the part's own digital twin, beads coloured by process data. Opened from Monitor.
 * - Assistance: an operator at the cell helped by a remote expert (tool wear, torch collision).
 *   Opened from the actions (`RemoteActions`) and the incident alert.
 * - Sandbox, shown as "Training": every tool the viewer has had so far, mocks included, for
 *   development, demos and training. Its `?mode=` key stays `sandbox`, so links keep working.
 *
 * The navbar (`ModeSwitcher`) shows Monitor, Assistance and Training; Part is a view of Monitor.
 */

export const VIEW_MODES = ["monitor", "part", "assistance", "sandbox"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

export type ModeInfo = {
  label: string;
  /** A Font Awesome icon class, without the `fas` prefix. */
  icon: string;
  /** What the mode is for, shown as the switcher's tooltip. */
  description: string;
  /** Built yet. Modes that are not are shown in the switcher, disabled, as the roadmap. */
  ready: boolean;
};

export const MODES: Record<ViewMode, ModeInfo> = {
  monitor: {
    label: "Monitor",
    icon: "fa-gauge-high",
    description: "Remote monitoring: is the build in spec, and if not, why?",
    ready: true,
  },
  part: {
    label: "Part",
    icon: "fa-cube",
    description:
      "The part's digital twin: where on the part did the process drift?",
    ready: true,
  },
  assistance: {
    label: "Diagnostic",
    icon: "fa-stethoscope",
    description:
      "Look at the cell, run the diagnostic, or ask a remote expert for help",
    ready: true,
  },
  sandbox: {
    label: "Training",
    icon: "fa-graduation-cap",
    description:
      "Every tool, on simulated data, mocks included: for training and demos",
    ready: true,
  },
};

/** The mode a URL without `?mode=` opens in. */
export const DEFAULT_MODE: ViewMode = "monitor";

const isViewMode = (value: string): value is ViewMode =>
  (VIEW_MODES as readonly string[]).includes(value);

/** The mode a `?mode=` value names: the default for a missing, unknown or not-yet-built one. */
export function parseViewMode(value: string | null): ViewMode {
  const key = value?.toLowerCase() ?? "";
  return isViewMode(key) && MODES[key].ready ? key : DEFAULT_MODE;
}
