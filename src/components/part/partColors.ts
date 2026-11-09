import {
  SIGNAL_IDS,
  SIGNALS,
  signalStatus,
  type SignalId,
  type SignalStatus,
} from "../../live/processFeed";

/**
 * How the Part mode colours the part, one colour job per metric:
 * - the bead's temperature is a magnitude: one hue (orange, for heat), light to dark, its anchor
 *   flipped on the dark theme so the hot end stands out of the background in both;
 * - current, voltage and wire speed are about which side of their WPS window they fall: diverging,
 *   blue below, red above, the bare metal's grey in the middle of the window;
 * - the deviation is a state: in WPS, out of it, far out, in the app's status colours, and always
 *   named with an icon in the legend and the inspector, never by colour alone.
 *
 * Colours are mixed in OKLab, so steps look even.
 */

export type PartMetric =
  "temperature" | "current" | "voltage" | "wireSpeed" | "deviation";

export type Theme = "light" | "dark";

export const PART_METRICS: {
  id: PartMetric;
  label: string;
  description: string;
}[] = [
  {
    id: "temperature",
    label: "Temp.",
    description: "Bead temperature behind the torch",
  },
  {
    id: "current",
    label: "Current",
    description: "Welding current vs its WPS window",
  },
  {
    id: "voltage",
    label: "Voltage",
    description: "Welding voltage vs its WPS window",
  },
  {
    id: "wireSpeed",
    label: "Wire",
    description: "Wire speed vs its WPS window",
  },
  {
    id: "deviation",
    label: "Deviation",
    description: "The worst of all signals against their WPS windows",
  },
];

/** sRGB, 0–1. */
export type Rgb = readonly [number, number, number];

//------------------------------------------------------------------------------
// OKLab.
//------------------------------------------------------------------------------
type Lab = readonly [number, number, number];

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hex(value: string): Rgb {
  const n = parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toLab([r, g, b]: Rgb): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (c: number) => Math.min(1, Math.max(0, c));
  return [
    clamp(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

/** A colour along a list of stops (hex), `t` 0–1, mixed in OKLab. */
function along(stops: readonly Lab[], t: number): Rgb {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [stops[i], stops[i + 1]];
  return fromLab([
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ]);
}

const labs = (...values: string[]) => values.map((v) => toLab(hex(v)));

//------------------------------------------------------------------------------
/** The bare metal: what a bead in the middle of its window, or with no data, looks like. */
const NEUTRAL = "#b9b8b2";

// One hue, light to dark; on the dark theme, dark to light. From the reference palette's orange.
const HEAT: Record<Theme, readonly Lab[]> = {
  light: labs("#fcd9c4", "#eb6834", "#8a300e"),
  dark: labs("#6b2a0c", "#d95926", "#ffc9a3"),
};

// Blue below the window, red above; the reference palette's diverging pair, per theme.
const BELOW: Record<Theme, string> = { light: "#2a78d6", dark: "#3987e5" };
const ABOVE: Record<Theme, string> = { light: "#e34948", dark: "#e66767" };
const DIVERGING: Record<Theme, readonly Lab[]> = {
  light: labs(BELOW.light, NEUTRAL, ABOVE.light),
  dark: labs(BELOW.dark, NEUTRAL, ABOVE.dark),
};

/** Reserved status colours: good is the bare metal (nothing to see), then warning and critical. */
export const STATUS_COLORS: Record<Exclude<SignalStatus, "idle">, string> = {
  ok: NEUTRAL,
  warn: "#fab219",
  alarm: "#d03b3b",
};

/**
 * Where a value sits against its window, -2–2: ±1 at the window's edges, ±2 where it turns from
 * out of range to far out (`signalStatus`'s alarm).
 */
export function windowPosition(id: SignalId, value: number) {
  const [low, high] = SIGNALS[id].band;
  const half = (high - low) / 2;
  return Math.max(-2, Math.min(2, (value - (low + half)) / half));
}

/**
 * The diverging scale's position, 0–1 (0.5 the window's middle). Gentle inside the window, steep
 * outside it: a value only stands out once it has left its window.
 */
function divergingT(position: number) {
  const away = Math.abs(position) / 2;
  const eased = away <= 0.5 ? away * 0.7 : 0.35 + (away - 0.5) * 1.3;
  return 0.5 + Math.sign(position) * eased * 0.5;
}

/** The worst status among a sample's signals. */
export function worstStatus(
  value: (id: SignalId) => number | null,
): SignalStatus {
  let worst: SignalStatus = "idle";
  for (const id of SIGNAL_IDS) {
    const status = signalStatus(id, value(id));
    if (status === "alarm") return "alarm";
    if (status === "warn") worst = "warn";
    else if (status === "ok" && worst === "idle") worst = "ok";
  }
  return worst;
}

/**
 * A sample's colour for `metric`; `value(id)` gives each signal's value there, `null` for none.
 * `null` when there is nothing to colour by.
 */
export function metricColor(
  metric: PartMetric,
  theme: Theme,
  value: (id: SignalId) => number | null,
): Rgb | null {
  if (metric === "deviation") {
    const status = worstStatus(value);
    return status === "idle" ? null : hex(STATUS_COLORS[status]);
  }
  const v = value(metric);
  if (v === null) {
    return null;
  }
  if (metric === "temperature") {
    const [min, max] = SIGNALS.temperature.scale;
    return along(HEAT[theme], (v - min) / (max - min));
  }
  return along(DIVERGING[theme], divergingT(windowPosition(metric, v)));
}

export const NEUTRAL_RGB = hex(NEUTRAL);

//------------------------------------------------------------------------------
// The legend.
//------------------------------------------------------------------------------
export type LegendTick = { at: number; label: string };

export type Legend =
  | {
      kind: "ramp";
      title: string;
      unit: string;
      /** A CSS gradient, left to right. */
      gradient: string;
      ticks: LegendTick[];
      /** The WPS window, 0–1 along the ramp. */
      band: readonly [number, number];
      /** What each end means, when it is a direction. */
      ends?: readonly [string, string];
    }
  | {
      kind: "classes";
      title: string;
      items: { color: string; icon: string; label: string }[];
    };

const css = ([r, g, b]: Rgb) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

const gradientOf = (color: (t: number) => Rgb) =>
  `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => `${css(color(i / 12))} ${((i / 12) * 100).toFixed(1)}%`).join(", ")})`;

export function legendFor(metric: PartMetric, theme: Theme): Legend {
  if (metric === "deviation") {
    return {
      kind: "classes",
      title: "Worst signal vs WPS",
      items: [
        { color: STATUS_COLORS.ok, icon: "fa-circle-check", label: "In WPS" },
        {
          color: STATUS_COLORS.warn,
          icon: "fa-triangle-exclamation",
          label: "Out of WPS",
        },
        {
          color: STATUS_COLORS.alarm,
          icon: "fa-circle-exclamation",
          label: "Far out",
        },
      ],
    };
  }
  const { label, unit, band, scale, decimals } = SIGNALS[metric];
  const format = (v: number) => v.toFixed(decimals);
  if (metric === "temperature") {
    const [min, max] = scale;
    const at = (v: number) => (v - min) / (max - min);
    return {
      kind: "ramp",
      title: label,
      unit,
      gradient: gradientOf((t) => along(HEAT[theme], t)),
      ticks: [min, band[0], band[1], max].map((v) => ({
        at: at(v),
        label: format(v),
      })),
      band: [at(band[0]), at(band[1])],
    };
  }
  // -2…2 around the window: its edges at a quarter and three quarters.
  const half = (band[1] - band[0]) / 2;
  const middle = band[0] + half;
  return {
    kind: "ramp",
    title: label,
    unit,
    gradient: gradientOf((t) =>
      along(DIVERGING[theme], divergingT((t - 0.5) * 4)),
    ),
    ticks: [-2, -1, 0, 1, 2].map((p) => ({
      at: (p + 2) / 4,
      label: format(middle + p * half),
    })),
    band: [0.25, 0.75],
    ends: ["Below", "Above"],
  };
}
