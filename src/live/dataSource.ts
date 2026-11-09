/**
 * Where what a widget shows comes from. Every widget showing machine data says it, so a viewer
 * never takes a simulation for the machine:
 * - `live`: the real machine, now;
 * - `sim`: simulated in the browser, not the machine;
 * - `replay`: recorded from the machine earlier;
 * - `none`: no source connected, nothing real to show.
 */
export type DataSource = "live" | "sim" | "replay" | "none";

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  live: "LIVE",
  sim: "SIM",
  replay: "REPLAY",
  none: "NOT CONNECTED",
};

export const DATA_SOURCE_DESCRIPTIONS: Record<DataSource, string> = {
  live: "Real data from the machine",
  sim: "Simulated data: not from the machine",
  replay: "Data recorded from the machine",
  none: "No source connected yet",
};
