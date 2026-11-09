import { useState } from "react";
import { Button, cn, Icon, Panel } from "@3dverse/ui-lib";

import { authorLabel, useAssist } from "../../assist/assistContext";
import { lastClosedIncident } from "../../assist/assistStore";
import { CHECKPOINTS } from "../../assist/checkpoints";
import {
  checksFor,
  diagnosticSummary,
  nextUnchecked,
  startDiagnosticRun,
  useDiagnosticRun,
} from "../../assist/diagnosticRun";
import {
  INCIDENT_KIND_IDS,
  INCIDENT_KINDS,
  type IncidentKind,
} from "../../assist/procedures";
import { useEventLog } from "../../live/eventLog";
import { formatClock } from "../../live/format";
import {
  formatSignal,
  SIGNAL_IDS,
  SIGNALS,
  signalStatus,
  useProcessFeed,
  type CnState,
} from "../../live/processFeed";
import { SourceBadge } from "../common/SourceBadge";
import { TimeAgo } from "../common/TimeAgo";
import { Row, SectionTitle } from "../supervision/SupervisionPanel";

/** Warnings and errors from the event log this recent are worth a look. */
const RECENT_MS = 15 * 60_000;
const RECENT_COUNT = 4;

const CN_STATE: Record<CnState, { label: string; className: string }> = {
  running: { label: "Running", className: "text-positive" },
  dwell: { label: "Between layers", className: "text-primary" },
  hold: { label: "On hold", className: "text-negative" },
};

/** A step of the Diagnostic: its number, its title, then what it holds. */
function Step({
  number,
  title,
  aside,
  children,
}: {
  number: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-3xs font-bold tracking-wider uppercase">
          <span className="size-4 grid place-items-center rounded-full bg-accent text-accent-100 text-5xs tabular-nums">
            {number}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The Diagnostic, before an incident, in three steps:
 * 1. look at the cell — the CN, its alarms, the signals out of their window, the recent warnings;
 * 2. say what happened (torch collision, tool wear, other);
 * 3. run the diagnostic — the robot's checkpoints one at a time (`DiagnosticRunPanel`) — or ask an
 *    expert, with what was found (`onRequest`, which opens the request).
 *
 * The expert does not run it (it is done at the machine): they see what the operator found, and
 * open the incident. The CN's alarms and state are simulated until the CN is connected.
 *
 * A panel of its own, the left column of the Diagnostic mode until an incident is opened; the last
 * incident closed, at its foot.
 */
export function Diagnostic({
  onRequest,
  className,
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
  className?: string;
}) {
  const { role, snapshot, incident } = useAssist();
  const process = useProcessFeed(500);
  const events = useEventLog();
  const run = useDiagnosticRun();
  const [kind, setKind] = useState<IncidentKind>("torch-collision");
  const isOperator = role === "operator";

  const cnState = CN_STATE[process.cn.state];
  const outOfWindow = SIGNAL_IDS.map((id) => ({
    id,
    value: process.values[id],
    status: signalStatus(id, process.values[id]),
  })).filter(({ status }) => status === "warn" || status === "alarm");
  const now = Date.now();
  const recent = events
    .filter(
      ({ level, at }) =>
        (level === "warn" || level === "error") && now - at < RECENT_MS,
    )
    .slice(0, RECENT_COUNT);

  // What the run has found so far.
  const checks = checksFor(snapshot, incident?.id ?? null);
  const checked = checks.size;
  const okCount = [...checks.values()].filter(
    ({ result }) => result === "ok",
  ).length;
  const resumeAt = nextUnchecked(checks);
  const askNote = checked > 0 ? diagnosticSummary(checks) : undefined;
  const last = lastClosedIncident(snapshot);

  return (
    <Panel
      className={cn(
        "flex flex-col backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <section className="shrink-0 px-4 py-3 border-b border-tertiary">
        <SectionTitle aside={<SourceBadge source={process.source} />}>
          Diagnostic
        </SectionTitle>
        <p className="text-2xs text-secondary">
          {isOperator
            ? "Find out what happened, then run the diagnostic."
            : "See what the cell says and what the operator found, then open an incident."}
        </p>
      </section>

      <div className="min-h-0 overflow-y-auto scroll-fade-y divide-y divide-tertiary">
        <Step number={1} title="Look at the cell">
          <div className="space-y-0.5">
            <Row
              label="CN"
              value={
                <span className={cnState.className}>
                  {cnState.label}
                  {process.cn.state === "hold" &&
                    process.cn.heldAt !== null &&
                    ` since ${formatClock(process.cn.heldAt)}`}
                </span>
              }
            />
            <Row
              label="Program"
              value={
                <code className="text-3xs">
                  {process.cn.program || "—"} · N{process.cn.block}
                </code>
              }
            />
          </div>

          <ul className="mt-2 space-y-1 text-2xs">
            {process.cn.alarms.length > 0 ? (
              process.cn.alarms.map((alarm) => (
                <li
                  key={alarm}
                  className="flex items-start gap-1.5 text-negative"
                >
                  <Icon className="fas fa-triangle-exclamation mt-0.5 text-3xs" />
                  {alarm}
                </li>
              ))
            ) : (
              <li className="flex items-center gap-1.5 text-secondary">
                <Icon className="fas fa-check text-3xs text-positive" />
                No alarm on the CN
              </li>
            )}
            {!process.arcOn ? (
              <li className="flex items-center gap-1.5 text-secondary">
                <Icon className="fas fa-power-off text-3xs" />
                Arc off: no welding signal to read
              </li>
            ) : outOfWindow.length > 0 ? (
              outOfWindow.map(({ id, value, status }) => (
                <li
                  key={id}
                  className={cn(
                    "flex items-center gap-1.5",
                    status === "alarm" ? "text-negative" : "text-warning",
                  )}
                >
                  <Icon
                    className={cn(
                      "fas text-3xs",
                      status === "alarm"
                        ? "fa-circle-exclamation"
                        : "fa-triangle-exclamation",
                    )}
                  />
                  {SIGNALS[id].label} out of its window:{" "}
                  <span className="tabular-nums">
                    {formatSignal(id, value)} {SIGNALS[id].unit}
                  </span>
                </li>
              ))
            ) : (
              <li className="flex items-center gap-1.5 text-secondary">
                <Icon className="fas fa-check text-3xs text-positive" />
                Every signal in its WPS window
              </li>
            )}
          </ul>

          <h4 className="mt-3 mb-1 text-3xs font-bold text-secondary">
            Recently
          </h4>
          {recent.length > 0 ? (
            <ol className="space-y-1 text-3xs">
              {recent.map((event) => (
                <li key={event.id} className="flex items-baseline gap-2">
                  <TimeAgo
                    at={event.at}
                    className="text-5xs text-tertiary tabular-nums shrink-0 w-15"
                  />
                  <span
                    className={cn(
                      "min-w-0 wrap-break-word text-balance",
                      event.level === "error"
                        ? "text-negative"
                        : "text-warning",
                    )}
                  >
                    {event.text}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-2xs text-secondary">
              No warning in the last {RECENT_MS / 60_000} minutes.
            </p>
          )}
        </Step>

        <Step number={2} title="What happened?">
          <div
            role="radiogroup"
            aria-label="What happened"
            className="grid grid-cols-3 gap-1.5"
          >
            {INCIDENT_KIND_IDS.map((id) => {
              const info = INCIDENT_KINDS[id];
              const isChecked = kind === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={isChecked}
                  onClick={() => setKind(id)}
                  className={cn(
                    "flex flex-col items-center justify-evenly gap-1 rounded-lg border px-1.5 py-2 text-center text-3xs leading-tight transition-colors cursor-pointer",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
                    isChecked
                      ? "border-accent bg-accent/15 text-primary"
                      : "border-tertiary text-secondary hover:border-secondary",
                  )}
                >
                  <Icon className={cn("fas text-xs", info.icon)} />
                  {info.label}
                </button>
              );
            })}
          </div>
        </Step>

        <Step
          number={3}
          title={isOperator ? "Run the diagnostic" : "What was found"}
          aside={
            checked > 0 && (
              <span className="text-4xs text-secondary tabular-nums">
                {okCount}/{CHECKPOINTS.length} OK
                {checked > okCount && ` · ${checked - okCount} skipped`}
              </span>
            )
          }
        >
          {isOperator ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="accent"
                size="sm"
                className="w-full justify-center text-white!"
                disabled={run !== null}
                title={`Check the robot's ${CHECKPOINTS.length} points one at a time, the camera on each`}
                onClick={() =>
                  startDiagnosticRun(
                    kind,
                    resumeAt < CHECKPOINTS.length ? resumeAt : 0,
                  )
                }
              >
                <Icon className="fas fa-list-check text-2xs" />
                {run
                  ? "Diagnostic running…"
                  : checked === 0
                    ? "Run the diagnostic"
                    : resumeAt < CHECKPOINTS.length
                      ? "Resume the diagnostic"
                      : "Run it again"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                title="Share the 3D session and what was found with a VLM expert"
                onClick={() => onRequest(kind, askNote)}
              >
                <Icon className="fas fa-headset text-2xs" />
                Ask an expert
              </Button>
              <p className="text-3xs text-secondary">
                The expert joins this 3D session and sees what you found.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-2xs text-secondary">
                {checked > 0
                  ? diagnosticSummary(checks)
                  : "The operator has not run the diagnostic yet."}
              </p>
              <Button
                variant="accent"
                size="sm"
                className="self-start text-white!"
                onClick={() => onRequest(kind, askNote)}
              >
                <Icon className="fas fa-plus text-2xs" />
                Open an incident
              </Button>
            </div>
          )}
        </Step>
      </div>

      {last?.closed && (
        <p className="shrink-0 px-4 py-2 text-3xs text-secondary border-t border-tertiary">
          Last: {INCIDENT_KINDS[last.kind].label},{" "}
          {last.closed.outcome === "resumed" ? "resumed" : "closed"}{" "}
          <TimeAgo at={last.closed.at} /> by {authorLabel(last.closed.by)}.
        </p>
      )}
    </Panel>
  );
}
