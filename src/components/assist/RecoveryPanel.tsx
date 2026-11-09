import { useState } from "react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Panel,
} from "@3dverse/ui-lib";
import { PanelTitle } from "../common/PanelTitle";

import { authorLabel, useAssist } from "../../assist/assistContext";
import {
  lastClosedIncident,
  stepsDone,
  type Presence,
  type StepRecord,
} from "../../assist/assistStore";
import {
  canTick,
  INCIDENT_KINDS,
  PHASE_LABELS,
  type IncidentKind,
  type Phase,
  type ProcedureStep,
} from "../../assist/procedures";
import { SectionTitle } from "../supervision/SupervisionPanel";
import { Diagnostic } from "./Diagnostic";
import { RoleChip } from "./RoleChip";
import { TimeAgo } from "../common/TimeAgo";

const PHASES: Phase[] = ["diagnose", "fix", "resume"];

/**
 * The way back to production for the incident open: its steps, Diagnose ➔ Fix ➔ Resume, each with
 * who does it. Anyone in the session ticks a step for everyone. Steps at the machine are the
 * operator's, and the last one, NC Start at the machine, closes the incident.
 *
 * Without an incident: the Diagnostic, which comes before opening one.
 */
export function RecoveryPanel({
  onRequest,
  className,
}: {
  /** Open an incident of this kind, the diagnostic done (`RequestDialog`). */
  onRequest: (kind: IncidentKind, note?: string) => void;
  className?: string;
}) {
  const { incident } = useAssist();
  return (
    <Panel
      className={cn(
        "flex flex-col backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      {incident ? <Recovery /> : <NoIncident onRequest={onRequest} />}
    </Panel>
  );
}

//------------------------------------------------------------------------------
function NoIncident({
  onRequest,
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
}) {
  const { snapshot } = useAssist();
  const last = lastClosedIncident(snapshot);

  return (
    <>
      <Diagnostic onRequest={onRequest} />
      {last?.closed && (
        <p className="shrink-0 px-4 py-2 text-3xs text-secondary border-t border-tertiary">
          Last: {INCIDENT_KINDS[last.kind].label},{" "}
          {last.closed.outcome === "resumed" ? "resumed" : "closed"}{" "}
          <TimeAgo at={last.closed.at} /> by {authorLabel(last.closed.by)}.
        </p>
      )}
    </>
  );
}

//------------------------------------------------------------------------------
function Recovery() {
  const { incident, snapshot, role, me, store, pointing, pointTo } =
    useAssist();
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  if (!incident) return null;

  const info = INCIDENT_KINDS[incident.kind];
  const done = stepsDone(snapshot, incident.id);
  const current = info.steps.find(({ id }) => !done.has(id)) ?? null;
  const pointers = new Map<string, Presence[]>();
  for (const presence of snapshot.presences) {
    if (!presence.pointing || presence.clientId === me?.clientId) continue;
    pointers.set(presence.pointing, [
      ...(pointers.get(presence.pointing) ?? []),
      presence,
    ]);
  }

  const toggle = (step: ProcedureStep) => {
    if (!store || !me || !canTick(step, role)) return;
    if (done.has(step.id)) {
      void store.setStepDone(incident, step.id, null);
    } else if (step.phase === "resume") {
      setIsResumeOpen(true);
    } else {
      void store.setStepDone(incident, step.id, me);
    }
  };

  const confirmResume = async () => {
    setIsResumeOpen(false);
    if (!store || !me) return;
    const resume = info.steps.find(({ phase }) => phase === "resume");
    if (resume) await store.setStepDone(incident, resume.id, me);
    store.closeIncident(incident, {
      at: Date.now(),
      by: me,
      outcome: "resumed",
    });
  };

  return (
    <>
      <header className="px-4 pt-3 pb-2 flex flex-col gap-1.5">
        <SectionTitle
          aside={
            <span className="text-3xs tabular-nums text-secondary">
              {done.size}/{info.steps.length}
            </span>
          }
        >
          Recovery
        </SectionTitle>
        <PanelTitle as="h2" className="flex items-center gap-2">
          <Icon className={cn("fas text-xs text-warning", info.icon)} />
          {info.label}
        </PanelTitle>
        <div
          className="h-1 rounded-full bg-tertiary/40 overflow-hidden"
          role="progressbar"
          aria-label="Recovery steps done"
          aria-valuemin={0}
          aria-valuemax={info.steps.length}
          aria-valuenow={done.size}
        >
          <div
            className="h-full bg-accent transition-[width] duration-500"
            style={{ width: `${(done.size / info.steps.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="min-h-0 overflow-y-auto scroll-fade-y px-2 pb-3">
        {PHASES.map((phase) => {
          const steps = info.steps.filter((step) => step.phase === phase);
          if (steps.length === 0) return null;
          return (
            <section key={phase} className="mt-2 first:mt-0">
              <h3 className="px-2 mb-1 text-5xs font-bold tracking-wider uppercase text-tertiary">
                {PHASE_LABELS[phase]}
              </h3>
              <ol className="flex flex-col gap-0.5">
                {steps.map((step) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    record={done.get(step.id) ?? null}
                    isCurrent={current?.id === step.id}
                    canTickIt={canTick(step, role)}
                    isExpert={role === "expert"}
                    pointers={pointers.get(step.id) ?? []}
                    isPointedByMe={pointing === step.id}
                    onToggle={() => toggle(step)}
                    onPoint={() =>
                      pointTo(pointing === step.id ? null : step.id)
                    }
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      <Dialog open={isResumeOpen} onOpenChange={setIsResumeOpen}>
        <DialogContent className="max-w-md backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Program resumed at the machine?</DialogTitle>
            <DialogDescription>
              Confirm once NC Start has been pressed at the machine and the
              program runs again. This closes the incident for everyone in the
              session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResumeOpen(false)}
            >
              Not yet
            </Button>
            <Button
              variant="accent"
              size="sm"
              className="text-white!"
              onClick={() => void confirmResume()}
            >
              Resumed: close the incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

//------------------------------------------------------------------------------
function StepRow({
  step,
  record,
  isCurrent,
  canTickIt,
  isExpert,
  pointers,
  isPointedByMe,
  onToggle,
  onPoint,
}: {
  step: ProcedureStep;
  record: StepRecord | null;
  isCurrent: boolean;
  canTickIt: boolean;
  isExpert: boolean;
  pointers: Presence[];
  isPointedByMe: boolean;
  onToggle: () => void;
  onPoint: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isExpanded =
    isCurrent || isOpen || pointers.length > 0 || isPointedByMe;
  const isDone = record !== null;

  return (
    <li
      className={cn(
        "rounded-md px-2 py-1.5",
        isCurrent && "bg-accent/10 ring-1 ring-accent/30",
        pointers.length > 0 && !isCurrent && "ring-1 ring-accent/50",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={`${step.title}: ${isDone ? "done" : "to do"}`}
          disabled={!canTickIt}
          onClick={onToggle}
          title={
            canTickIt
              ? isDone
                ? "Mark as not done"
                : "Mark as done, for everyone"
              : "Done at the machine, by the operator"
          }
          className={cn(
            "mt-0.5 size-4 shrink-0 grid place-items-center rounded border transition-colors",
            isDone ? "bg-accent border-accent text-white" : "border-secondary",
            canTickIt
              ? "hover:border-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {isDone && <Icon className="fas fa-check text-5xs" />}
        </button>
        <button
          type="button"
          className="grow min-w-0 text-left"
          aria-expanded={isExpanded}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span
            className={cn(
              "block text-2xs font-medium",
              isDone && "line-through text-secondary",
            )}
          >
            {step.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <RoleChip role={step.actor} />
            {step.atMachine && (
              <span className="inline-flex items-center gap-1 text-5xs text-secondary">
                <Icon className="fas fa-hand" />
                At the machine
              </span>
            )}
          </span>
        </button>
      </div>

      {isDone && (
        <p className="pl-6 mt-0.5 text-5xs text-tertiary">
          Done by {authorLabel(record.by)} · <TimeAgo at={record.at} />
        </p>
      )}

      {pointers.length > 0 && (
        <p className="pl-6 mt-1 flex items-center gap-1 text-3xs text-accent-300">
          <Icon className="fas fa-hand-point-right" />
          {pointers.map(({ name }) => name).join(", ")}{" "}
          {pointers.length === 1 ? "points" : "point"} here
        </p>
      )}

      {isExpanded && !isDone && (
        <div className="pl-6 mt-1 flex flex-col items-start gap-1">
          <p className="mt-1 text-3xs text-secondary">{step.detail}</p>
          {step.caution && (
            <p className="flex items-start gap-1 text-3xs text-warning">
              <Icon className="fas fa-triangle-exclamation mt-0.5" />
              {step.caution}
            </p>
          )}
          {!canTickIt && (
            <p className="text-3xs text-tertiary">
              Waiting for the operator at the machine.
            </p>
          )}
          {isExpert && (
            <Button
              variant="ghost"
              size="xs"
              className={cn(
                "-ml-2 text-3xs",
                isPointedByMe && "text-accent-300",
              )}
              aria-pressed={isPointedByMe}
              onClick={onPoint}
            >
              <Icon className="fas fa-hand-point-right text-5xs" />
              {isPointedByMe
                ? "You point the others here · stop"
                : "Point the others here"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
