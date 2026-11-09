import { DOM3DEntityAnchor, DOM3DOverlay } from "@3dverse/livelink-react";
import { cn, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";
import type { CheckRecord } from "../../assist/assistStore";
import { CHECKPOINTS, type Checkpoint } from "../../assist/checkpoints";
import {
  checksFor,
  showCheckpoint,
  useDiagnosticRun,
} from "../../assist/diagnosticRun";
import { useCheckpointEntity } from "../../assist/useCheckpointEntities";
import { formatRelative } from "../../live/format";
import { STATUS_COLORS } from "../part/partColors";

const COLORS = {
  ok: "var(--color-positive)",
  skipped: "var(--color-content-tertiary)",
  todo: STATUS_COLORS.warn,
} as const;

/**
 * The points to check on the robot (`checkpoints.ts`), over the robot, in the Diagnostic. The
 * operator checks them, one click each, and unchecks a point the same way; the expert sees what was
 * found, by whom and when. Checks belong to the incident open, over those of the Diagnostic before
 * it (`checksFor`).
 *
 * While the diagnostic runs (`diagnosticRun.ts`), the point being checked stands out, its details
 * open, and the others step back; a click on another point goes to it.
 *
 * Each point is a dot on its entity, with its card above and to the right of it, on a short
 * leader: off the joint itself, where the angle gauges are.
 *
 * Must be rendered inside the `Viewport`.
 */
export function AssistCheckpoints() {
  const { role, snapshot, incident } = useAssist();
  const entityOf = useCheckpointEntity();
  const run = useDiagnosticRun();

  if (!role) return null;

  const incidentId = incident?.id ?? null;
  const checks = checksFor(snapshot, incidentId);
  const current =
    run && run.index < CHECKPOINTS.length ? CHECKPOINTS[run.index].id : null;

  return (
    <DOM3DOverlay>
      {CHECKPOINTS.map((checkpoint, index) => {
        const entity = entityOf(checkpoint);
        if (!entity) return null;
        return (
          <DOM3DEntityAnchor
            key={checkpoint.id}
            entity={entity}
            offset="center"
          >
            <CheckpointMarker
              checkpoint={checkpoint}
              number={index + 1}
              check={checks.get(checkpoint.id) ?? null}
              incidentId={incidentId}
              isCurrent={current === checkpoint.id}
              isRunning={run !== null}
              onSelect={() => showCheckpoint(index)}
            />
          </DOM3DEntityAnchor>
        );
      })}
    </DOM3DOverlay>
  );
}

function CheckpointMarker({
  checkpoint,
  number,
  check,
  incidentId,
  isCurrent,
  isRunning,
  onSelect,
}: {
  checkpoint: Checkpoint;
  number: number;
  check: CheckRecord | null;
  incidentId: string | null;
  /** The point the diagnostic is on. */
  isCurrent: boolean;
  /** The diagnostic is running: a click goes to the point rather than checking it. */
  isRunning: boolean;
  onSelect: () => void;
}) {
  const { store, me, role } = useAssist();
  const isOperator = role === "operator";
  const state = check?.result ?? "todo";
  const color = COLORS[state];
  const isOk = state === "ok";

  const onClick = () => {
    if (isRunning) {
      onSelect();
      return;
    }
    if (!store || !me || !isOperator) return;
    void store.setChecked(incidentId, checkpoint.id, isOk ? null : me, "ok");
  };

  const status = check
    ? `${check.result === "skipped" ? "Skipped" : "Checked"} by ${check.by.name}, ${formatRelative(check.at)}`
    : isOperator
      ? "To check"
      : "To check by the operator";

  return (
    // The dot is the anchored box, so the point sits on the entity; the rest hangs off it.
    <div
      className={cn(
        "relative size-3 transition-opacity duration-300",
        isRunning && !isCurrent && "opacity-40 hover:opacity-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full ring-2 ring-white/90",
          (state === "todo" || isCurrent) && "motion-safe:animate-pulse",
          isCurrent && "scale-150",
        )}
        style={{ background: isCurrent ? "var(--color-accent-300)" : color }}
      />
      {/* The leader, up and to the right. */}
      <span
        aria-hidden
        className="absolute left-1.5 bottom-1.5 w-6 h-px origin-bottom-left -rotate-45"
        style={{ background: color }}
      />
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isOk}
        aria-current={isCurrent ? "step" : undefined}
        aria-disabled={!isRunning && !isOperator}
        title={
          isRunning
            ? `${checkpoint.detail}. Click to check it now.`
            : isOperator
              ? `${checkpoint.detail}. ${isOk ? "Click to uncheck." : "Click once checked."}`
              : `${checkpoint.detail}. Checked by the operator, at the machine.`
        }
        className={cn(
          "group absolute left-5 bottom-5 flex items-start gap-1.5 w-max max-w-56",
          "rounded-lg border-2 bg-ground/85 backdrop-blur-md px-2 py-1 text-left shadow-lg pointer-events-auto",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isRunning || isOperator
            ? "cursor-pointer hover:bg-ground"
            : "cursor-default",
          isCurrent && "ring-2 ring-accent-300",
        )}
        style={{ borderColor: isCurrent ? "var(--color-accent-300)" : color }}
      >
        <span
          className="mt-px size-4 shrink-0 grid place-items-center rounded-full text-5xs font-bold text-white"
          style={{ background: color }}
        >
          {state === "ok" ? (
            <Icon className="fas fa-check text-5xs" />
          ) : state === "skipped" ? (
            <Icon className="fas fa-forward text-5xs" />
          ) : (
            number
          )}
        </span>
        <span className="flex flex-col">
          <span
            className={cn(
              "text-2xs font-semibold whitespace-nowrap",
              isOk && !isCurrent && "line-through decoration-1 opacity-70",
            )}
          >
            {checkpoint.label}
          </span>
          {/* What to check, and who did: on hover or focus — always for the point being checked. */}
          <span
            className={cn(
              "text-4xs text-secondary",
              isCurrent
                ? "block"
                : "hidden group-hover:block group-focus-visible:block",
            )}
          >
            {checkpoint.detail}
          </span>
          <span className="hidden group-hover:block group-focus-visible:block text-5xs text-tertiary">
            {status}
          </span>
        </span>
      </button>
    </div>
  );
}
