import { useMemo, type ReactNode } from "react";
import { cn, Icon } from "@3dverse/ui-lib";

import type { Machine } from "../../config";
import {
  useIncidentDigest,
  type IncidentDigest,
} from "../../assist/incidentDigest";
import { INCIDENT_KINDS } from "../../assist/procedures";
import {
  useBuildRecord,
  useProcessFeed,
  type CnState,
} from "../../live/processFeed";
import { findingOf } from "../part/layerFindings";
import { SourceBadge, TimeAgo } from "../common";

/** A closed incident stays on the tile this long. */
const RECENT_INCIDENT_MS = 24 * 60 * 60_000;

const CN_STATE: Record<CnState, { label: string; dot: string }> = {
  running: { label: "Running", dot: "bg-positive" },
  dwell: { label: "Between layers", dot: "bg-secondary" },
  hold: { label: "On hold", dot: "bg-negative" },
};

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/**
 * What a machine's tile says at a glance, in a few short rows:
 * - for a machine in production (one with a build plate, where the part is shown): the machine
 *   (the CN's state, its alarm), its production order (order and part, when it ends, the layers
 *   laid, what it has used so far) and the part's quality (the layers out of their WPS window) —
 *   simulated, like everywhere in the app, until the machine's data is connected, and badged so;
 * - for one not yet in production: that there is no production data for it yet;
 * - for any: its last incident, as this browser last saw it (`incidentDigest.ts`). Called open
 *   only while the machine's session runs (`isLive`): with the session gone, so is the incident.
 */
export function MachineInsights({
  machine,
  isLive,
}: {
  machine: Machine;
  isLive: boolean;
}) {
  const digest = useIncidentDigest(machine.sceneId);
  const incident = digest && <IncidentRow digest={digest} isLive={isLive} />;
  const production = machine.buildPlate ? (
    <Production />
  ) : machine.status !== "deprecated" ? (
    <NoProduction />
  ) : null;

  if (!production && !incident) return null;
  return (
    <ul className="flex flex-col gap-1.5 text-2xs">
      {production}
      {incident}
    </ul>
  );
}

//------------------------------------------------------------------------------
/** One line: an icon (or a dot) in a fixed column, then what it says, cut short if need be. */
function Row({
  icon,
  className,
  children,
}: {
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("flex items-center gap-2 min-w-0", className)}>
      <span className="w-3.5 shrink-0 grid place-items-center">{icon}</span>
      <span className="flex items-center gap-1.5 min-w-0 grow">{children}</span>
    </li>
  );
}

function RowIcon({ name }: { name: string }) {
  return <Icon className={cn("fas text-3xs", name)} />;
}

//------------------------------------------------------------------------------
function Production() {
  const { source, cn: cnState, job } = useProcessFeed(1000);
  const build = useBuildRecord(2000);
  const state = CN_STATE[cnState.state];
  const progress = Math.max(0, (job.layer - 1) / job.layers);
  const percent = Math.round(progress * 100);
  const alarm = cnState.alarms[0];

  // The layers that left their WPS window, and whether any went far out.
  const quality = useMemo(() => {
    let out = 0;
    let far = false;
    for (const record of build.records) {
      const finding = record ? findingOf(record) : null;
      if (!finding) continue;
      out += 1;
      far ||= finding.status === "alarm";
    }
    return { out, far };
    // `version` changes whenever a record does; the records themselves are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build.version, build.records]);

  return (
    <>
      <Row
        icon={
          <span
            className={cn(
              "size-2 rounded-full",
              state.dot,
              cnState.state === "running" && "motion-safe:animate-pulse",
            )}
          />
        }
      >
        <span className="font-semibold text-primary whitespace-nowrap">
          {state.label}
        </span>
        {cnState.state === "hold" && cnState.heldAt !== null && (
          <span className="text-secondary whitespace-nowrap">
            since {formatTime(cnState.heldAt)}
          </span>
        )}
        {alarm && (
          <span className="truncate text-negative" title={alarm}>
            · {alarm}
          </span>
        )}
        <SourceBadge source={source} className="ml-auto shrink-0" />
      </Row>

      {/* The production order: what is being built, and when it ends. */}
      <Row icon={<RowIcon name="fa-clipboard-list text-secondary" />}>
        <span
          className="truncate"
          title={`Order ${job.order} · part ${job.part}`}
        >
          <span className="font-semibold text-primary">{job.order}</span>
          <span className="text-secondary"> · {job.part}</span>
        </span>
        <span className="ml-auto shrink-0 text-secondary tabular-nums">
          {job.eta !== null ? `ends ${formatTime(job.eta)}` : "paused"}
        </span>
      </Row>

      <Row icon={<RowIcon name="fa-layer-group text-secondary" />}>
        <span className="shrink-0 text-secondary tabular-nums">
          Layer{" "}
          <span className="text-primary">
            {job.layer}/{job.layers}
          </span>
        </span>
        <span
          className="h-1 min-w-6 grow rounded-full bg-tertiary/40 overflow-hidden"
          role="progressbar"
          aria-label="Build progress"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full bg-accent"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
        <span className="w-8 shrink-0 text-right text-secondary tabular-nums">
          {percent}%
        </span>
      </Row>

      {/* What the order has used so far: wire, shielding gas, arc energy. */}
      <Row icon={<RowIcon name="fa-gauge-simple text-secondary" />}>
        <span
          className="truncate text-secondary tabular-nums"
          title="Used so far: wire, shielding gas, arc energy"
        >
          {job.wireKg.toFixed(2)} kg wire · {Math.round(job.gasL)} L gas ·{" "}
          {job.energyKWh.toFixed(2)} kWh
        </span>
      </Row>

      {quality.out === 0 ? (
        <Row icon={<RowIcon name="fa-check text-positive" />}>
          <span className="text-secondary truncate">
            Every layer in its WPS window
          </span>
        </Row>
      ) : (
        <Row
          icon={
            <RowIcon
              name={cn(
                quality.far
                  ? "fa-circle-exclamation text-negative"
                  : "fa-triangle-exclamation text-warning",
              )}
            />
          }
        >
          <span
            className={cn(
              "truncate",
              quality.far ? "text-negative" : "text-warning",
            )}
          >
            {quality.out} {quality.out === 1 ? "layer" : "layers"} out of WPS
          </span>
        </Row>
      )}
    </>
  );
}

//------------------------------------------------------------------------------
/** A machine whose production is not connected to the twin: no order to show. */
function NoProduction() {
  return (
    <Row icon={<RowIcon name="fa-clipboard text-tertiary" />}>
      <span className="truncate text-secondary">No production data yet</span>
    </Row>
  );
}

//------------------------------------------------------------------------------
function IncidentRow({
  digest,
  isLive,
}: {
  digest: IncidentDigest;
  isLive: boolean;
}) {
  const label = INCIDENT_KINDS[digest.kind].label;

  if (digest.closedAt === null) {
    // Seen open, but the session that held it has ended: nothing to say for sure.
    if (!isLive) return null;
    return (
      <Row
        icon={<RowIcon name="fa-triangle-exclamation text-negative" />}
        className="text-negative"
      >
        <span className="font-semibold whitespace-nowrap">Incident open</span>
        <span className="truncate">· {label}</span>
        <TimeAgo
          at={digest.openedAt}
          className="ml-auto shrink-0 text-secondary"
        />
      </Row>
    );
  }

  if (Date.now() - digest.closedAt > RECENT_INCIDENT_MS) return null;
  return (
    <Row icon={<RowIcon name="fa-clock-rotate-left text-tertiary" />}>
      <span className="truncate text-secondary">
        Last incident · {label},{" "}
        {digest.outcome === "resumed" ? "resumed" : "closed"}
      </span>
      <TimeAgo
        at={digest.closedAt}
        className="ml-auto shrink-0 text-tertiary"
      />
    </Row>
  );
}
