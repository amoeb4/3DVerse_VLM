import { useEffect, useState } from "react";

import { logEvent } from "./eventLog";
import type { DataSource } from "./dataSource";

/**
 * The welding process as the Monitor and Part modes show it: the arc's electrical signals, wire and
 * gas, the arc's sound, the bead's temperature, the CN's state, the job's progress, and the record of
 * every layer laid (`useBuildRecord`), which the Part mode colours the part with.
 *
 * Nothing from the machine reaches the app for these yet (see the plan's real-vs-mock table), so
 * this store runs a SIMULATION while `source` is `sim`, and says so: every widget built on it
 * carries a SIM badge. The simulation runs a WAAM-like build — layers of arc time separated by an
 * interpass dwell — and, every minute or two, a scripted drift (voltage creeping up, an unstable
 * arc, gas flow dropping, the wire slipping, heat building up), the client's "process drift"
 * scenario. It starts from the part's first layer, fast-forwarded, so the part already has a
 * history when the viewer opens.
 *
 * A real adapter, once there is one (the CLM server's `readAquisition`, the Fronius power source,
 * the Sinumerik's OPC UA server), feeds `ingestProcessSample`: that switches the store to `live`
 * and stops the simulation.
 *
 * Same pattern as `weldLog`: module state, read through a hook that refreshes on a timer when the
 * state has changed. The simulation only runs while something shows it.
 */

//------------------------------------------------------------------------------
export type SignalId =
  | "current"
  | "voltage"
  | "wireSpeed"
  | "gasFlow"
  | "arcSound"
  | "arcStability"
  | "temperature";

export type SignalSpec = {
  label: string;
  unit: string;
  decimals: number;
  /** The welding procedure's window (WPS): inside it, the process is in spec. */
  band: readonly [number, number];
  /** The range the signal is charted on. */
  scale: readonly [number, number];
};

// Values for a steel WAAM bead with 1.2 mm wire; the WPS windows are placeholders until VLM gives
// the real ones.
export const SIGNALS: Record<SignalId, SignalSpec> = {
  current: {
    label: "Current",
    unit: "A",
    decimals: 0,
    band: [165, 195],
    scale: [130, 230],
  },
  voltage: {
    label: "Voltage",
    unit: "V",
    decimals: 1,
    band: [20, 23],
    scale: [17, 26],
  },
  wireSpeed: {
    label: "Wire speed",
    unit: "m/min",
    decimals: 1,
    band: [7.2, 8.8],
    scale: [6, 10],
  },
  gasFlow: {
    label: "Gas flow",
    unit: "L/min",
    decimals: 1,
    band: [12, 18],
    scale: [6, 22],
  },
  arcSound: {
    label: "Arc sound",
    unit: "dB",
    decimals: 0,
    band: [78, 90],
    scale: [65, 105],
  },
  arcStability: {
    label: "Arc stability",
    unit: "%",
    decimals: 0,
    band: [85, 100],
    scale: [50, 100],
  },
  // Behind the torch, as a pyrometer or a thermal camera would read it.
  temperature: {
    label: "Bead temp.",
    unit: "°C",
    decimals: 0,
    band: [380, 540],
    scale: [320, 620],
  },
};

export const SIGNAL_IDS = Object.keys(SIGNALS) as SignalId[];

/** `idle`: the arc is off, there is nothing to judge. */
export type SignalStatus = "ok" | "warn" | "alarm" | "idle";

/** Out of the WPS window by up to half its width is a warning; further out, an alarm. */
export function signalStatus(id: SignalId, value: number | null): SignalStatus {
  if (value === null || Number.isNaN(value)) {
    return "idle";
  }
  const [low, high] = SIGNALS[id].band;
  if (value >= low && value <= high) {
    return "ok";
  }
  const margin = (high - low) / 2;
  return value >= low - margin && value <= high + margin ? "warn" : "alarm";
}

export function formatSignal(id: SignalId, value: number | null) {
  return value === null || Number.isNaN(value)
    ? "—"
    : value.toFixed(SIGNALS[id].decimals);
}

/**
 * The process settings a remote expert may change, and their bounds: Fronius-style arc-length and
 * dynamics corrections, the wire speed inside its WPS window, and the CN's feed override.
 */
export type Corrections = {
  arcLength: number;
  dynamics: number;
  wireSpeed: number;
  override: number;
};

export const CORRECTION_LIMITS: Record<
  keyof Corrections,
  { label: string; unit: string; min: number; max: number; step: number }
> = {
  arcLength: {
    label: "Arc-length correction",
    unit: "",
    min: -10,
    max: 10,
    step: 0.5,
  },
  dynamics: { label: "Arc dynamics", unit: "", min: -10, max: 10, step: 0.5 },
  wireSpeed: {
    label: "Wire speed",
    unit: "m/min",
    min: SIGNALS.wireSpeed.band[0],
    max: SIGNALS.wireSpeed.band[1],
    step: 0.1,
  },
  override: { label: "Feed override", unit: "%", min: 50, max: 120, step: 5 },
};

/**
 * - `running`: the program runs, the arc burns;
 * - `dwell`: between two layers, waiting for the interpass temperature;
 * - `hold`: stopped by a stop request (NC Stop / feed hold); only NC Start at the machine resumes.
 */
export type CnState = "running" | "dwell" | "hold";

export type ProcessSnapshot = {
  source: DataSource;
  arcOn: boolean;
  /** `null` while the arc is off. */
  values: Record<SignalId, number | null>;
  /** The last `HISTORY_LENGTH` samples, oldest first; `NaN` while the arc was off. */
  history: Record<SignalId, readonly number[]>;
  cn: {
    program: string;
    block: number;
    state: CnState;
    override: number;
    alarms: readonly string[];
    /** `Date.now()` when it was put on hold. */
    heldAt: number | null;
  };
  job: {
    order: string;
    part: string;
    layer: number;
    layers: number;
    /** `Date.now()` the build should end at; `null` while on hold. */
    eta: number | null;
    wireKg: number;
    gasL: number;
    energyKWh: number;
  };
  corrections: Corrections;
};

/** One sample every `SAMPLE_MS`; the history holds a minute of them. */
export const SAMPLE_MS = 200;
export const HISTORY_LENGTH = 300;

//------------------------------------------------------------------------------
// The simulated build.
//------------------------------------------------------------------------------
const LAYER_ARC_S = 45;
const DWELL_S = 8;
/**
 * The plan: what a layer takes at 100 % feed, arc and dwell. Part mode's timeline spans the build
 * at this pace (planned length), whatever the override did since.
 */
export const PLANNED_LAYER_S = LAYER_ARC_S + DWELL_S;
/** 1.2 mm steel wire. */
const WIRE_KG_PER_M = 0.00888;
const NOMINAL_VOLTAGE = 21.5;
const AMPS_PER_WIRE_SPEED = 22.5;
const NOMINAL_GAS = 15;
const NOMINAL_SOUND = 84;
const NOMINAL_STABILITY = 96;
const NOMINAL_POWER = NOMINAL_VOLTAGE * 180;
const NOMINAL_TEMPERATURE = 430;
/** The layer the build has reached when the viewer opens. */
const START_LAYER = 42;
/** A status must hold this long before it is logged, so a value grazing a limit does not flap. */
const LOG_AFTER_MS = 1000;

type Drift = {
  voltage: number;
  current: number;
  wireSpeed: number;
  gas: number;
  sound: number;
  /** 0–25: how much the arc's stability suffers. */
  instability: number;
  temperature: number;
};

type Episode = {
  name: string;
  peak: Partial<Drift>;
  rampS: number;
  holdS: number;
  backS: number;
};

// Each one a drift the client's slides name: abnormal arc noise and crackling, process parameters
// (voltage, wire speed) and gas leaving their window.
const EPISODES: Episode[] = [
  {
    name: "voltage creep",
    peak: { voltage: 2.4 },
    rampS: 15,
    holdS: 60,
    backS: 15,
  },
  {
    name: "arc instability",
    peak: { instability: 22, sound: 7 },
    rampS: 6,
    holdS: 20,
    backS: 6,
  },
  {
    name: "gas flow drop",
    peak: { gas: -6.5 },
    rampS: 12,
    holdS: 30,
    backS: 8,
  },
  {
    name: "wire slip",
    peak: { wireSpeed: -0.9 },
    rampS: 10,
    holdS: 25,
    backS: 10,
  },
  {
    name: "heat build-up",
    peak: { temperature: 150 },
    rampS: 25,
    holdS: 40,
    backS: 20,
  },
];

const NO_DRIFT: Drift = {
  voltage: 0,
  current: 0,
  wireSpeed: 0,
  gas: 0,
  sound: 0,
  instability: 0,
  temperature: 0,
};

/** Every signal `null`: the arc is off. */
const NO_VALUES = Object.fromEntries(
  SIGNAL_IDS.map((id) => [id, null]),
) as Record<SignalId, number | null>;

const emptyHistory = () =>
  Object.fromEntries(SIGNAL_IDS.map((id) => [id, [] as number[]])) as Record<
    SignalId,
    number[]
  >;

let source: DataSource = "sim";
/** Simulated time, in seconds. */
let simTime = 0;
let layerElapsed = 0;
let arcOn = true;
let cnState: CnState = "running";
let stateBeforeHold: CnState = "running";
let heldAt: number | null = null;
let layer = 1;
const layers = 120;
let corrections: Corrections = {
  arcLength: 0,
  dynamics: 0,
  wireSpeed: 8,
  override: 100,
};
let values: Record<SignalId, number | null> = {
  current: 180,
  voltage: NOMINAL_VOLTAGE,
  wireSpeed: 8,
  gasFlow: NOMINAL_GAS,
  arcSound: NOMINAL_SOUND,
  arcStability: NOMINAL_STABILITY,
  temperature: NOMINAL_TEMPERATURE,
};
/** What the noise wanders around, kept while the arc is off so it comes back where it was. */
const smoothed: Record<SignalId, number> = { ...values } as Record<
  SignalId,
  number
>;
let history = emptyHistory();
let wireKg = 0;
let gasL = 0;
let energyKWh = 0;

/**
 * While the build is fast-forwarded to `START_LAYER` at load: its clock is then simulated, starting
 * as long ago as those layers took, so their records carry plausible times.
 */
let warmingUp = true;
const warmUpStartedAt =
  Date.now() - (START_LAYER - 1) * (LAYER_ARC_S + DWELL_S) * 1000;
const clockNow = () =>
  warmingUp ? warmUpStartedAt + simTime * 1000 : Date.now();

let episode: { spec: Episode; startedAt: number } | null = null;
let nextEpisodeAt = 0;

const loggedStatus: Record<SignalId, SignalStatus> = Object.fromEntries(
  SIGNAL_IDS.map((id) => [id, "ok"]),
) as Record<SignalId, SignalStatus>;
const pendingStatus: Partial<
  Record<SignalId, { status: SignalStatus; since: number }>
> = {};

let version = 0;

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** How far into its peak the current episode is, 0–1. */
function episodeLevel(now: number) {
  if (!episode) {
    return 0;
  }
  const { rampS, holdS, backS } = episode.spec;
  const t = now - episode.startedAt;
  if (t < rampS) return t / rampS;
  if (t < rampS + holdS) return 1;
  if (t < rampS + holdS + backS) return 1 - (t - rampS - holdS) / backS;
  return -1;
}

function currentDrift(): Drift {
  if (!episode) {
    return NO_DRIFT;
  }
  const level = episodeLevel(simTime);
  if (level < 0) {
    episode = null;
    // Rarer in the fast-forwarded past, so the part is not drift from end to end.
    nextEpisodeAt =
      simTime +
      (warmingUp ? 240 + Math.random() * 200 : 60 + Math.random() * 60);
    return NO_DRIFT;
  }
  const drift = { ...NO_DRIFT };
  for (const [key, peak] of Object.entries(episode.spec.peak)) {
    drift[key as keyof Drift] = (peak as number) * level;
  }
  return drift;
}

/** Moves `smoothed[id]` towards `target`, with noise: a first-order lag, ~0.6 s. */
function wander(id: SignalId, target: number, sigma: number, dt: number) {
  const pull = 1 - Math.exp(-dt / 0.6);
  smoothed[id] +=
    (target - smoothed[id]) * pull + sigma * Math.sqrt(dt) * gaussian();
  return smoothed[id];
}

/** Kept in place, copied for the snapshots: the warm-up pushes thousands of samples. */
function pushHistory(next: Record<SignalId, number | null>) {
  for (const id of SIGNAL_IDS) {
    const value = next[id];
    history[id].push(value === null ? NaN : value);
    if (history[id].length > HISTORY_LENGTH) {
      history[id].shift();
    }
  }
}

/** Logs a signal leaving or coming back into its window, once the change has held. */
function logStatusChanges(
  next: Record<SignalId, number | null>,
  simulated: boolean,
) {
  const now = Date.now();
  for (const id of SIGNAL_IDS) {
    const status = signalStatus(id, next[id]);
    if (status === "idle" || status === loggedStatus[id]) {
      delete pendingStatus[id];
      continue;
    }
    const pending = pendingStatus[id];
    if (!pending || pending.status !== status) {
      pendingStatus[id] = { status, since: now };
      continue;
    }
    if (now - pending.since < LOG_AFTER_MS) {
      continue;
    }
    const { label, unit, band } = SIGNALS[id];
    const reading = `${formatSignal(id, next[id])} ${unit}`;
    const range = `WPS ${band[0]}–${band[1]} ${unit}`;
    if (status === "ok") {
      logEvent("ok", "process", `${label} back in range (${reading})`, {
        simulated,
      });
    } else if (status === "warn") {
      logEvent(
        "warn",
        "process",
        `${label} out of range: ${reading} (${range})`,
        { simulated },
      );
    } else {
      logEvent(
        "error",
        "process",
        `${label} far out of range: ${reading} (${range})`,
        { simulated },
      );
    }
    loggedStatus[id] = status;
    delete pendingStatus[id];
  }
}

/** One step of the simulation, `dt` seconds long. `silent` steps log nothing (the warm-up). */
function step(dt: number, silent = false) {
  if (cnState !== "hold") {
    simTime += dt;
    const speed = corrections.override / 100;
    const arcS = LAYER_ARC_S / speed;
    layerElapsed += dt;

    if (cnState === "running" && layerElapsed >= arcS) {
      cnState = "dwell";
      layerElapsed = 0;
      finishLayer();
    } else if (cnState === "dwell" && layerElapsed >= DWELL_S) {
      cnState = "running";
      layerElapsed = 0;
      if (layer >= layers) {
        startNewPart(silent);
      } else {
        layer += 1;
      }
      if (!silent) {
        logEvent("info", "process", `Layer ${layer}/${layers} started`, {
          simulated: true,
        });
      }
    }

    if (!episode && simTime >= nextEpisodeAt) {
      episode = {
        spec: EPISODES[Math.floor(Math.random() * EPISODES.length)],
        startedAt: simTime,
      };
    }
  }
  arcOn = cnState === "running";

  const drift = currentDrift();
  const instability = Math.max(
    0,
    drift.instability - Math.max(0, corrections.dynamics) * 1.5,
  );
  const shaky = 1 + instability / 8;

  const wireSpeed = wander(
    "wireSpeed",
    corrections.wireSpeed + drift.wireSpeed,
    0.08,
    dt,
  );
  const current = wander(
    "current",
    AMPS_PER_WIRE_SPEED * wireSpeed + drift.current,
    4 * shaky,
    dt,
  );
  const voltage = wander(
    "voltage",
    NOMINAL_VOLTAGE + 0.15 * corrections.arcLength + drift.voltage,
    0.15 * shaky,
    dt,
  );
  const gasFlow = wander("gasFlow", NOMINAL_GAS + drift.gas, 0.25, dt);
  // Crackling: short bursts of sound while the arc is unstable.
  const crackle =
    instability > 4 && Math.random() < 0.2 ? 5 + Math.random() * 8 : 0;
  const arcSound =
    wander("arcSound", NOMINAL_SOUND + drift.sound, 1.2 * shaky, dt) + crackle;
  const arcStability = clamp(
    wander(
      "arcStability",
      NOMINAL_STABILITY - instability + 0.2 * corrections.dynamics,
      0.8,
      dt,
    ),
    0,
    100,
  );
  // The arc's power heats the bead, and so does the heat the part has stored, higher up the build.
  const temperature = wander(
    "temperature",
    NOMINAL_TEMPERATURE +
      (voltage * current - NOMINAL_POWER) * 0.05 +
      80 * (layer / layers) +
      drift.temperature,
    3,
    dt,
  );

  values = arcOn
    ? {
        current,
        voltage,
        wireSpeed,
        gasFlow,
        arcSound,
        arcStability,
        temperature,
      }
    : NO_VALUES;

  if (arcOn) {
    wireKg += (wireSpeed / 60) * dt * WIRE_KG_PER_M;
    gasL += (gasFlow / 60) * dt;
    energyKWh += (voltage * current * dt) / 3.6e6;
    recordSample(values, Math.min(1, layerElapsed / (LAYER_ARC_S / speedOf())));
  }

  pushHistory(values);
  if (!silent) {
    logStatusChanges(values, true);
  }
  version += 1;
}

//------------------------------------------------------------------------------
// The build record: every layer laid, sample by sample along its ring.
//------------------------------------------------------------------------------
/** Samples kept per layer, evenly along its ring: each the mean of what was measured there. */
export const LAYER_SAMPLES = 96;

export type LayerRecord = {
  layer: number;
  /** `Date.now()`-like times; `endedAt` is `null` while the layer is being laid. */
  startedAt: number;
  endedAt: number | null;
  /** 0–1: how much of the ring is laid. */
  progress: number;
  /** Per signal, `LAYER_SAMPLES` values along the ring; `NaN` where nothing is laid yet. */
  samples: Record<SignalId, Float32Array>;
  /** Bumped on every change, so a view redraws only the layers that changed. */
  version: number;
};

let records: LayerRecord[] = [];
let recordsVersion = 0;
const sampleSums = Object.fromEntries(
  SIGNAL_IDS.map((id) => [id, new Float64Array(LAYER_SAMPLES)]),
) as Record<SignalId, Float64Array>;
const sampleCounts = new Uint16Array(LAYER_SAMPLES);

const speedOf = () => corrections.override / 100;

function recordSample(
  sample: Record<SignalId, number | null>,
  progress: number,
) {
  let record = records[layer - 1];
  if (!record) {
    record = {
      layer,
      startedAt: clockNow(),
      endedAt: null,
      progress: 0,
      samples: Object.fromEntries(
        SIGNAL_IDS.map((id) => [id, new Float32Array(LAYER_SAMPLES).fill(NaN)]),
      ) as Record<SignalId, Float32Array>,
      version: 0,
    };
    records[layer - 1] = record;
    sampleCounts.fill(0);
    for (const id of SIGNAL_IDS) {
      sampleSums[id].fill(0);
    }
  }
  const bucket = Math.min(
    LAYER_SAMPLES - 1,
    Math.floor(progress * LAYER_SAMPLES),
  );
  sampleCounts[bucket] += 1;
  for (const id of SIGNAL_IDS) {
    const value = sample[id];
    if (value === null) continue;
    sampleSums[id][bucket] += value;
    record.samples[id][bucket] = sampleSums[id][bucket] / sampleCounts[bucket];
  }
  record.progress = progress;
  record.version += 1;
  recordsVersion += 1;
}

function finishLayer() {
  const record = records[layer - 1];
  if (record) {
    record.progress = 1;
    record.endedAt = clockNow();
    record.version += 1;
    recordsVersion += 1;
  }
}

/** The last layer is done: the next part starts, from its first layer and with its own counters. */
function startNewPart(silent: boolean) {
  layer = 1;
  records = [];
  wireKg = 0;
  gasL = 0;
  energyKWh = 0;
  recordsVersion += 1;
  if (!silent) {
    logEvent("ok", "process", "Part complete: the next one starts", {
      simulated: true,
    });
  }
}

/**
 * The build so far, fast-forwarded before anyone looks: from the first layer to a little way into
 * `START_LAYER`, so the part has a history and the charts start full.
 */
function warmUp() {
  nextEpisodeAt = 200;
  while (!(
    layer === START_LAYER &&
    cnState === "running" &&
    layerElapsed >= 12
  )) {
    step(SAMPLE_MS / 1000, true);
  }
  warmingUp = false;
  // The first drift comes soon after the panel opens, then every minute or two.
  if (!episode) {
    nextEpisodeAt = simTime + 40;
  }
}
warmUp();

//------------------------------------------------------------------------------
let timer = 0;
let lastTick = 0;
let consumers = 0;

/** Keeps the simulation running while the calling component is mounted. */
function useRunningSimulation() {
  useEffect(() => {
    consumers += 1;
    startSimulation();
    return () => {
      consumers -= 1;
      if (consumers === 0) {
        stopSimulation();
      }
    };
  }, []);
}

function startSimulation() {
  if (timer || source !== "sim") {
    return;
  }
  lastTick = performance.now();
  timer = window.setInterval(() => {
    const now = performance.now();
    // After the tab slept, carry on rather than replay what was missed.
    const dt = Math.min(now - lastTick, SAMPLE_MS * 3) / 1000;
    lastTick = now;
    step(dt);
  }, SAMPLE_MS);
}

function stopSimulation() {
  window.clearInterval(timer);
  timer = 0;
}

//------------------------------------------------------------------------------
// The machine's side. A real adapter calls this; it ends the simulation.
//------------------------------------------------------------------------------
export function ingestProcessSample(sample: Partial<Record<SignalId, number>>) {
  if (source !== "live") {
    source = "live";
    stopSimulation();
    history = emptyHistory();
  }
  values = { ...values, ...sample };
  arcOn = SIGNAL_IDS.some((id) => values[id] !== null);
  pushHistory(values);
  logStatusChanges(values, false);
  version += 1;
}

//------------------------------------------------------------------------------
// Remote actions. On the simulation they change the simulated machine, so a demo responds; the UI
// logs the action itself. Nothing here reaches the real machine.
//------------------------------------------------------------------------------
export function applyCorrections(next: Partial<Corrections>) {
  if (source !== "sim") {
    return;
  }
  const bounded = { ...corrections };
  for (const [key, value] of Object.entries(next)) {
    const { min, max } = CORRECTION_LIMITS[key as keyof Corrections];
    bounded[key as keyof Corrections] = clamp(value, min, max);
  }
  corrections = bounded;
  version += 1;
}

/** The simulated CN goes into feed hold, as an NC Stop would put it. */
export function holdSimulation() {
  if (source !== "sim" || cnState === "hold") {
    return;
  }
  stateBeforeHold = cnState;
  cnState = "hold";
  heldAt = Date.now();
  arcOn = false;
  logEvent("warn", "process", "CN in feed hold (NC Stop): arc off", {
    simulated: true,
  });
  version += 1;
}

/** NC Start, as the operator would press it at the machine. Simulation only. */
export function simulateOnSiteStart() {
  if (source !== "sim" || cnState !== "hold") {
    return;
  }
  cnState = stateBeforeHold;
  heldAt = null;
  logEvent(
    "ok",
    "process",
    "NC Start pressed at the machine: program resumed",
    {
      simulated: true,
    },
  );
  version += 1;
}

//------------------------------------------------------------------------------
function snapshot(): ProcessSnapshot {
  const arcS = LAYER_ARC_S / (corrections.override / 100);
  // On hold, the layer stays where the stop caught it.
  const phase = cnState === "hold" ? stateBeforeHold : cnState;
  const layerProgress =
    phase === "running" ? Math.min(1, layerElapsed / arcS) : 1;
  const remainingS =
    (layers - layer) * (arcS + DWELL_S) +
    (phase === "dwell"
      ? DWELL_S - layerElapsed
      : arcS - layerElapsed + DWELL_S);
  return {
    source,
    arcOn,
    values,
    history: Object.fromEntries(
      SIGNAL_IDS.map((id) => [id, history[id].slice()]),
    ) as Record<SignalId, number[]>,
    cn: {
      program: "WAAM_P118.MPF",
      block: layer * 100 + Math.floor(layerProgress * 99),
      state: cnState,
      override: corrections.override,
      alarms: [],
      heldAt,
    },
    job: {
      order: "OF-2411-07",
      part: "P-118",
      layer,
      layers,
      eta: cnState === "hold" ? null : Date.now() + remainingS * 1000,
      wireKg,
      gasL,
      energyKWh,
    },
    corrections,
  };
}

/**
 * The process, refreshed every `refreshMs` when it has changed. While anything uses it, the
 * simulation runs (when the source is `sim`).
 */
export function useProcessFeed(refreshMs = 250): ProcessSnapshot {
  useRunningSimulation();
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    let seen = -1;
    const update = () => {
      if (version !== seen) {
        seen = version;
        setState(snapshot());
      }
    };
    update();
    const id = window.setInterval(update, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);
  return state;
}

/**
 * Whether the machine is welding — its CN running a layer, the arc on — checked every `refreshMs`.
 * Off in the dwell between two layers and on hold. While anything uses it, the simulation runs.
 */
export function useArcOn(refreshMs = 250): boolean {
  useRunningSimulation();
  const [isOn, setIsOn] = useState(arcOn);
  useEffect(() => {
    const update = () => setIsOn(arcOn);
    update();
    const id = window.setInterval(update, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);
  return isOn;
}

export type BuildRecord = {
  source: DataSource;
  layers: number;
  /** The layer being laid, or just laid while in dwell. */
  currentLayer: number;
  arcOn: boolean;
  /** One per layer laid so far, `records[n - 1]` for layer n. Mutable: watch `version`. */
  records: readonly LayerRecord[];
  version: number;
};

function buildSnapshot(): BuildRecord {
  return {
    source,
    layers,
    currentLayer: layer,
    arcOn,
    records,
    version: recordsVersion,
  };
}

/**
 * The part as built so far, layer by layer, refreshed every `refreshMs` when it has changed. The
 * records are shared, not copied: compare each record's `version` to redraw only what changed.
 */
export function useBuildRecord(refreshMs = 500): BuildRecord {
  useRunningSimulation();
  const [state, setState] = useState(buildSnapshot);
  useEffect(() => {
    let seen = -1;
    const update = () => {
      if (recordsVersion !== seen) {
        seen = recordsVersion;
        setState(buildSnapshot());
      }
    };
    update();
    const id = window.setInterval(update, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);
  return state;
}
