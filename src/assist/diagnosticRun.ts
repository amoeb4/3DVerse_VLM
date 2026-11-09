import { useSyncExternalStore } from "react";

import type { CheckRecord, AssistSnapshot } from "./assistStore";
import { CHECKPOINTS } from "./checkpoints";
import type { IncidentKind } from "./procedures";

/**
 * "Run the diagnostic": the operator goes through the robot's checkpoints (`checkpoints.ts`) one at
 * a time — the camera on the point, a panel to validate or skip it — what the Diagnostic panel
 * starts, the run panel drives and the markers on the robot follow. This viewer's own run: what it
 * finds is shared (check records), the walk through it is not.
 *
 * `index` is the checkpoint shown; `CHECKPOINTS.length` once all have been gone through (the
 * summary). `kind`: what the operator said happened, for asking an expert from the run.
 */
export type DiagnosticRun = {
  index: number;
  kind: IncidentKind;
};

let run: DiagnosticRun | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function startDiagnosticRun(kind: IncidentKind, index = 0) {
  run = { index, kind };
  emit();
}

export function showCheckpoint(index: number) {
  if (!run) return;
  run = { ...run, index: Math.max(0, Math.min(CHECKPOINTS.length, index)) };
  emit();
}

export function stopDiagnosticRun() {
  run = null;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The run under way; `null` when none. */
export function useDiagnosticRun(): DiagnosticRun | null {
  return useSyncExternalStore(subscribe, () => run);
}

//------------------------------------------------------------------------------
/**
 * What has been found at each point, by checkpoint: those of the incident open, over those of the
 * Diagnostic before it (`incidentId` null) — so what was checked before asking for help is still
 * there once the incident is open.
 */
export function checksFor(
  snapshot: AssistSnapshot,
  incidentId: string | null,
): Map<string, CheckRecord> {
  const checks = new Map<string, CheckRecord>();
  for (const check of snapshot.checks) {
    if (check.incidentId === null) checks.set(check.checkId, check);
  }
  if (incidentId !== null) {
    for (const check of snapshot.checks) {
      if (check.incidentId === incidentId) checks.set(check.checkId, check);
    }
  }
  return checks;
}

/** The first checkpoint nothing has been found at yet; the summary when all have. */
export function nextUnchecked(checks: Map<string, CheckRecord>): number {
  const index = CHECKPOINTS.findIndex(({ id }) => !checks.has(id));
  return index === -1 ? CHECKPOINTS.length : index;
}

/** The run in a few lines, for the expert: what is fine, what was skipped, what is left. */
export function diagnosticSummary(checks: Map<string, CheckRecord>): string {
  const ok = CHECKPOINTS.filter(({ id }) => checks.get(id)?.result === "ok");
  const skipped = CHECKPOINTS.filter(
    ({ id }) => checks.get(id)?.result === "skipped",
  );
  const left = CHECKPOINTS.filter(({ id }) => !checks.has(id));
  const list = (items: typeof CHECKPOINTS) =>
    items.map(({ label }) => label).join(", ");
  const lines = [`Diagnostic: ${ok.length}/${CHECKPOINTS.length} points OK.`];
  if (skipped.length > 0) lines.push(`Skipped: ${list(skipped)}.`);
  if (left.length > 0) lines.push(`Not checked yet: ${list(left)}.`);
  return lines.join(" ");
}
