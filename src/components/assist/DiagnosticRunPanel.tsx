import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { DefaultCameraController } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";
import { Panel, SubTitleSection, TimeAgo } from "../common";

import { useAssist } from "../../assist/assistContext";
import type { CheckResult } from "../../assist/assistStore";
import { CHECKPOINTS } from "../../assist/checkpoints";
import {
  checksFor,
  diagnosticSummary,
  showCheckpoint,
  stopDiagnosticRun,
  useDiagnosticRun,
} from "../../assist/diagnosticRun";
import { INCIDENT_KINDS, type IncidentKind } from "../../assist/procedures";
import { useCheckpointEntity } from "../../assist/useCheckpointEntities";

/** How far from a checkpoint the camera stands, in metres: nearer for the torch tip. */
const VIEW_DISTANCE = 1.1;
const TORCH_VIEW_DISTANCE = 0.7;
/** The camera looks at a point from a little above it. */
const MIN_ELEVATION = 0.35;

const RESULT_STYLE: Record<CheckResult | "todo", string> = {
  ok: "bg-positive",
  skipped: "bg-tertiary",
  todo: "bg-secondary/30",
};

/**
 * "Run the diagnostic", step by step: one checkpoint at a time, the camera on it, and this panel —
 * centered under it — to validate it or skip it, then on to the next. What is found is shared at
 * once (check records), so a remote expert follows along. At any step, "Ask an expert" opens the
 * request with what was found so far; the session itself is what the expert joins. After the last
 * point, a summary. Done, Stop or Esc end the run, and the camera goes back to the Diagnostic's
 * view: the scene's point of interest for it, or the default view (`useModeCamera`).
 */
export function DiagnosticRunPanel({
  cameraController,
  onAskExpert,
  onEnd,
}: {
  cameraController: DefaultCameraController | null;
  /** Opens the request for an expert, with what happened and what was found. */
  onAskExpert: (kind: IncidentKind, note: string) => void;
  /** The run ended here (Done, Stop, Esc): the camera back to the Diagnostic's view. */
  onEnd: () => void;
}) {
  const run = useDiagnosticRun();
  const { store, me, snapshot, incident } = useAssist();
  const entityOf = useCheckpointEntity();

  const incidentId = incident?.id ?? null;
  const checks = checksFor(snapshot, incidentId);
  const index = run?.index ?? 0;
  const checkpoint = index < CHECKPOINTS.length ? CHECKPOINTS[index] : null;
  const entity = checkpoint ? entityOf(checkpoint) : null;

  // The camera to the point being checked, from the side it already looks from, a little above.
  useEffect(() => {
    if (!run || !checkpoint || !entity || !cameraController) return;
    const target = new THREE.Vector3(...entity.global_transform.position);
    const from = cameraController.getPosition(new THREE.Vector3()).sub(target);
    if (from.lengthSq() < 1e-6) from.set(1, 1, 1);
    from.normalize();
    from.y = Math.max(from.y, MIN_ELEVATION);
    from.normalize();
    const distance =
      "euid" in checkpoint.anchor ? TORCH_VIEW_DISTANCE : VIEW_DISTANCE;
    void cameraController.travel({
      position: target.clone().addScaledVector(from, distance).toArray() as [
        number,
        number,
        number,
      ],
      look_at: target.toArray() as [number, number, number],
    });
    // Once per point: the entity follows the robot, the camera does not chase it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.index, run !== null, entity, cameraController]);

  // Done, Stop or Esc: the run ends, and the camera leaves the last point for the Diagnostic's view.
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  const endRun = useCallback(() => {
    stopDiagnosticRun();
    onEndRef.current();
  }, []);

  // Escape leaves the run.
  useEffect(() => {
    if (!run) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") endRun();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, endRun]);

  if (!run) return null;

  const record = (result: CheckResult) => {
    if (!store || !me || !checkpoint) return;
    void store.setChecked(incidentId, checkpoint.id, me, result);
    showCheckpoint(index + 1);
  };
  const askExpert = () => onAskExpert(run.kind, diagnosticSummary(checks));

  const found = checkpoint ? checks.get(checkpoint.id) : undefined;
  const okCount = CHECKPOINTS.filter(
    ({ id }) => checks.get(id)?.result === "ok",
  ).length;
  const skipped = CHECKPOINTS.filter(
    ({ id }) => checks.get(id)?.result === "skipped",
  );

  return (
    <div
      role="dialog"
      aria-label="Diagnostic"
      className={cn(
        // Centered, under the point the camera is on, over the toolbar at the bottom.
        "fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(var(--spacing-navbar)+3.5rem)]",
        "w-[min(30rem,calc(100%-2rem))]",
        "starting:opacity-0 starting:translate-y-4 transition-all duration-300",
      )}
    >
      <Panel
        variant="glass"
        className="flex flex-col gap-3 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.25)] border border-accent/40"
      >
        <header className="flex items-center justify-between gap-3">
          <div className="grow flex items-center gap-2 min-w-0">
            <Icon className="fas fa-stethoscope text-2xs text-accent-300" />
            <SubTitleSection as="span" className="truncate">
              Diagnostic · {INCIDENT_KINDS[run.kind].label}
            </SubTitleSection>
          </div>
          {checkpoint && (
            <p className="text-3xs text-secondary tabular-nums">
              Point {index + 1} of {CHECKPOINTS.length}
            </p>
          )}
        </header>

        {/* Where the run is: a step per point, coloured by what was found; a click goes to it. */}
        <ol className="flex gap-1" aria-label="Checkpoints">
          {CHECKPOINTS.map(({ id, label }, step) => {
            const result = checks.get(id)?.result ?? "todo";
            return (
              <li key={id} className="grow">
                <button
                  type="button"
                  title={`${label}: ${result === "todo" ? "to check" : result === "ok" ? "OK" : "skipped"}`}
                  aria-current={step === index ? "step" : undefined}
                  onClick={() => showCheckpoint(step)}
                  className={cn(
                    "block w-full h-1.5 rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    RESULT_STYLE[result],
                    step === index &&
                      "ring-2 ring-accent-300 ring-offset-1 ring-offset-ground",
                  )}
                />
              </li>
            );
          })}
        </ol>

        {checkpoint ? (
          <>
            <div>
              <h2 className="text-xl font-bold">{checkpoint.label}</h2>
              <p className="text-xs">{checkpoint.detail}</p>
              {found && (
                <p className="mt-1 text-4xs text-tertiary">
                  {found.result === "ok" ? "Validated" : "Skipped"} by{" "}
                  {found.by.name} · <TimeAgo at={found.at} />
                </p>
              )}
              {!entity && (
                <p className="mt-1 text-4xs text-warning">
                  This point is not in this machine's scene: check it at the
                  machine.
                </p>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-secondary"
                title="Stop the diagnostic (Esc): what was found stays"
                onClick={endRun}
              >
                Stop
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => record("skipped")}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  className="bg-positive hover:bg-positive/90 text-positive-100!"
                  onClick={() => record("ok")}
                >
                  <Icon className="fas fa-check text-2xs" />
                  Validate
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-bold">Diagnostic done</h2>
              <div className="space-y-1 mt-2 text-2xs text-secondary">
                <p>
                  {okCount} of {CHECKPOINTS.length} points OK
                </p>
                <p>
                  {skipped.length > 0 &&
                    `Skipped: ${skipped.map(({ label }) => label).join(", ")}`}
                  .
                </p>
              </div>
            </div>
            <footer className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={askExpert}>
                <Icon className="fas fa-headset text-2xs" />
                Ask an expert
              </Button>
              <Button
                variant="accent"
                size="sm"
                className="min-w-20 text-white!"
                onClick={endRun}
              >
                Done
              </Button>
            </footer>
          </>
        )}
      </Panel>
    </div>
  );
}
