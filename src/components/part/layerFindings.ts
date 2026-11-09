import {
  LAYER_SAMPLES,
  SIGNAL_IDS,
  signalStatus,
  type LayerRecord,
  type SignalId,
} from "../../live/processFeed";
import { windowPosition } from "./partColors";

/** A layer where the process left its WPS window: its worst moment. */
export type LayerFinding = {
  layer: number;
  status: "warn" | "alarm";
  signal: SignalId;
  value: number;
  /** The sample, along the layer, where it was furthest out. */
  sample: number;
};

/** The layer's worst moment out of its window, or `null` when it stayed in. */
export function findingOf(record: LayerRecord): LayerFinding | null {
  let worst: LayerFinding | null = null;
  let worstDistance = 0;
  for (let sample = 0; sample < LAYER_SAMPLES; sample += 1) {
    for (const id of SIGNAL_IDS) {
      const value = record.samples[id][sample];
      if (Number.isNaN(value)) continue;
      const status = signalStatus(id, value);
      if (status !== "warn" && status !== "alarm") continue;
      const distance = Math.abs(windowPosition(id, value));
      const outranks =
        !worst ||
        (status === "alarm" && worst.status === "warn") ||
        (status === worst.status && distance > worstDistance);
      if (outranks) {
        worst = { layer: record.layer, status, signal: id, value, sample };
        worstDistance = distance;
      }
    }
  }
  return worst;
}
