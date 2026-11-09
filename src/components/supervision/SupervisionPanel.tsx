import { useContext, useEffect, useId, useMemo, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import { Button, cn, Icon, Panel } from "@3dverse/ui-lib";
import { PanelTitle } from "../common/PanelTitle";

import { PartEntitiesContext } from "../../partEntitiesContext";
import { jointInfoFor, twistAngle } from "../joints/joints";
import { LiveBadge } from "../LiveBadge";
import { SourceBadge } from "../common/SourceBadge";
import { Sparkline } from "../common/Sparkline";
import { useLiveLink } from "../../live/liveLink";
import {
  clearEvents,
  logEvent,
  useEventLog,
  type EventLevel,
} from "../../live/eventLog";
import { RECENT_WELDS, useWeldStats } from "../../live/weldLog";
import { formatClock, formatDuration } from "../../live/format";
import { TimeAgo } from "../common/TimeAgo";

/** How often the joints are sampled, for their speeds and to tell moving from stopped. */
const SAMPLE_MS = 200;
/** Faster than this, in °/s, on any joint and the robot is moving. */
const MOVING_SPEED = 0.5;
/** Slower than `STOPPED_SPEED` for this long and it has stopped: a pause mid-path is not a stop. */
const STOPPED_SPEED = 0.2;
const STOPPED_AFTER_MS = 1500;
/** The temperature scale the weld points are coloured on (`weldBead.tsx`). */
const WELD_SCALE = { min: 0, max: 100 };

type JointReading = {
  id: string;
  label: string;
  axis: "x" | "y" | "z";
  angle: number;
  /** °/s, signed. */
  speed: number;
};

/** Wrap a difference of angles into (-180, 180]. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * The robot's joints, sampled every `SAMPLE_MS`: angles and speeds, and whether it is moving.
 *
 * Runs all the time, so the event log records the robot starting and stopping even while the
 * panel is closed; the readings only go through React while `active`.
 */
function useJointTelemetry(active: boolean) {
  const { entities } = useContext(PartEntitiesContext);
  const joints = useMemo(
    () =>
      entities
        .filter((entity) => /^part_\d+$/.test(entity.name ?? ""))
        .sort(
          (a, b) =>
            Number(a.name!.split("_")[1]) - Number(b.name!.split("_")[1]),
        )
        .map((entity) => ({ entity, info: jointInfoFor(entity) })),
    [entities],
  );
  const [readings, setReadings] = useState<JointReading[]>([]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (joints.length === 0) {
      return;
    }
    let previous: Map<string, number> | null = null;
    let previousAt = performance.now();
    let isMoving = false;
    let slowSince: number | null = null;

    const sample = () => {
      const now = performance.now();
      const dt = (now - previousAt) / 1000;
      const angles = new Map<string, number>();
      const next: JointReading[] = joints.map(({ entity, info }) => {
        const angle = twistAngle(
          entity.local_transform?.orientation ?? [0, 0, 0, 1],
          info.axis,
        );
        angles.set(entity.id, angle);
        const before = previous?.get(entity.id);
        const speed =
          before === undefined || dt <= 0 ? 0 : wrap(angle - before) / dt;
        return {
          id: entity.id,
          label: info.label,
          axis: info.axis,
          angle,
          speed,
        };
      });
      previous = angles;
      previousAt = now;

      const fastest = Math.max(0, ...next.map((j) => Math.abs(j.speed)));
      if (!isMoving && fastest > MOVING_SPEED) {
        isMoving = true;
        slowSince = null;
        logEvent("info", "robot", "Robot moving");
        setMoving(true);
      } else if (isMoving && fastest < STOPPED_SPEED) {
        slowSince ??= now;
        if (now - slowSince > STOPPED_AFTER_MS) {
          isMoving = false;
          logEvent("info", "robot", "Robot stopped");
          setMoving(false);
        }
      } else if (isMoving) {
        slowSince = null;
      }

      if (active) {
        setReadings(next);
      }
    };

    sample();
    const timer = window.setInterval(sample, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [joints, active]);

  return { readings, moving };
}

/**
 * Remote supervision: everything a supervisor away from the cell needs to trust and follow the
 * robot — the live link's health, every joint's angle and speed, the welding, and a log of what
 * happened. Stays mounted while closed, so its log keeps recording.
 *
 * `docked`: always open, laid out by its parent (the Monitor mode's right column), without its
 * close button nor the demo's welding section, which Monitor's process panel replaces. `children`
 * are extra sections, shown before the events.
 */
export function SupervisionPanel({
  isOpen,
  onClose,
  docked = false,
  className,
  children,
}: {
  isOpen: boolean;
  onClose?: () => void;
  docked?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const open = docked || isOpen;
  const { readings, moving } = useJointTelemetry(open);

  return (
    <Panel
      aria-hidden={!open}
      className={cn(
        "flex flex-col divide-y divide-tertiary backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        docked
          ? "min-h-0"
          : [
              "fixed top-15 lg:top-28 right-4 bottom-24 z-50 w-[90vw] max-w-96",
              "origin-top-right transition-[opacity,translate,scale,visibility] duration-300 ease-out motion-reduce:transition-none",
              isOpen
                ? "opacity-100 translate-x-0 scale-100 visible"
                : "opacity-0 translate-x-4 scale-95 invisible",
            ],
        className,
      )}
    >
      <header className="flex justify-between items-center px-4 py-1.5">
        <PanelTitle>{docked ? "Cell" : "Remote supervision"}</PanelTitle>
        {onClose && !docked && (
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <Icon className="fas fa-close" />
          </Button>
        )}
      </header>

      {/* The sections scroll, under the header: the panel never grows past its column. */}
      <div className="min-h-0 grow overflow-y-auto overscroll-contain scroll-fade-y divide-y divide-tertiary">
        {open && <LinkSection />}
        <RobotSection readings={readings} moving={moving} />
        {open && children}
        {open && !docked && <WeldSection />}
        {open && <EventSection />}
      </div>
    </Panel>
  );
}

//------------------------------------------------------------------------------
export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <h2 className="text-3xs font-bold tracking-wider uppercase">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 text-2xs">
      <span className="text-secondary">{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}

//------------------------------------------------------------------------------
/**
 * The live link's health, folded by default: its badge (live, no data, offline, with the reconnect
 * button) stays in the summary, the details open on demand. The badge sits beside the toggle rather
 * than in it, so its own button stays a button of its own.
 */
function LinkSection() {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-1.5 -ml-1 px-1 py-1 rounded-md cursor-pointer hover:bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon
            className={cn(
              "fas fa-chevron-right text-5xs text-secondary transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
          <h2 className="text-3xs font-bold tracking-wider uppercase">
            Link to the robot
          </h2>
        </button>
        <LiveBadge showDetail={false} />
      </div>
      {isOpen && <LinkDetails id={contentId} />}
    </section>
  );
}

function LinkDetails({ id }: { id: string }) {
  const link = useLiveLink(500);
  const { instance } = useContext(LivelinkContext);
  const streamLatency = (instance as { latency?: number } | null)?.latency;
  const now = Date.now();

  return (
    <div id={id} className="mt-1.5 mb-1">
      <div className="space-y-0.5">
        <Row
          label="Feed"
          value={<code className="text-3xs">{link.url || "—"}</code>}
        />
        <Row
          label="Connected for"
          value={
            link.connectedSince !== null
              ? formatDuration(now - link.connectedSince)
              : "—"
          }
        />
        <Row
          label="Messages"
          value={`${Math.round(link.rate)} /s · ${link.totalMessages.toLocaleString()} total`}
        />
        <Row
          label="Data latency"
          value={
            link.latencyMs !== null
              ? `${Math.round(link.latencyMs)} ms`
              : "not timestamped"
          }
        />
        <Row
          label="3D stream latency"
          value={
            typeof streamLatency === "number" && streamLatency > 0
              ? `${Math.round(streamLatency)} ms`
              : "—"
          }
        />
        <Row
          label="Last update"
          value={
            link.lastMessageAt !== null
              ? `${formatClock(link.lastMessageAt)} (${formatDuration(now - link.lastMessageAt)} ago)`
              : "never"
          }
        />
      </div>
    </div>
  );
}

//------------------------------------------------------------------------------
/** The design-token colour of a joint's axis, as `JointGauge` draws it. */
const axisColor = (axis: JointReading["axis"]) => `var(--axis-color-${axis})`;

function RobotSection({
  readings,
  moving,
}: {
  readings: JointReading[];
  moving: boolean;
}) {
  // The axes are the twin's: the robot's own only while its feed is live.
  const { status } = useLiveLink(1000);
  return (
    <section className="px-4 py-3">
      <SectionTitle
        aside={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-3xs font-bold",
              moving ? "text-positive" : "text-secondary",
            )}
          >
            <SourceBadge source={status === "live" ? "live" : "none"} />
            <span
              className={cn(
                "size-1.5 rounded-full",
                moving ? "bg-positive animate-pulse" : "bg-secondary/50",
              )}
            />
            {moving ? "MOVING" : "STOPPED"}
          </span>
        }
      >
        Robot axes
      </SectionTitle>
      {readings.length === 0 ? (
        <p className="text-2xs text-secondary">Waiting for the robot model…</p>
      ) : (
        <table className="w-full text-2xs tabular-nums">
          <tbody>
            {readings.map((joint, index) => (
              <tr key={joint.id} className="h-5">
                <td className="pr-2 text-secondary whitespace-nowrap">
                  J{index + 1}{" "}
                  <span className="text-primary">{joint.label}</span>
                </td>
                <td className="w-full">
                  {/* -180° … +180°, 0 in the middle. */}
                  <div className="relative h-1 rounded-full bg-tertiary/40">
                    <div className="absolute left-1/2 top-1/2 h-2 w-px -translate-y-1/2 bg-secondary/60" />
                    <div
                      className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${((joint.angle + 180) / 360) * 100}%`,
                        background: axisColor(joint.axis),
                      }}
                    />
                  </div>
                </td>
                <td
                  className="pl-2 text-right whitespace-nowrap"
                  style={{ color: axisColor(joint.axis) }}
                >
                  {joint.angle >= 0 ? "+" : "−"}
                  {Math.abs(joint.angle).toFixed(1)}°
                </td>
                <td
                  className={cn(
                    "pl-2 w-16 text-right whitespace-nowrap",
                    Math.abs(joint.speed) < STOPPED_SPEED && "text-secondary",
                  )}
                >
                  {Math.abs(joint.speed).toFixed(1)}°/s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

//------------------------------------------------------------------------------
function WeldSection() {
  const welds = useWeldStats();
  const fmt = (value: number | null) =>
    value === null ? "—" : `${Math.round(value)} °C`;

  return (
    <section className="px-4 py-3">
      <SectionTitle
        aside={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-3xs font-bold",
              welds.welding ? "text-accent" : "text-secondary",
            )}
          >
            <SourceBadge source="sim" />
            {welds.welding ? "WELDING" : "IDLE"}
          </span>
        }
      >
        Welding
      </SectionTitle>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <Stat label="Points" value={welds.count.toLocaleString()} />
        <Stat label="Last" value={fmt(welds.last?.temperature ?? null)} />
        <Stat label="Mean" value={fmt(welds.mean)} />
        <Stat label="Max" value={fmt(welds.max)} />
      </div>
      <Sparkline
        values={welds.recent.map((w) => w.temperature)}
        length={RECENT_WELDS}
        min={WELD_SCALE.min}
        max={WELD_SCALE.max}
        label={`Temperature of the last ${welds.recent.length} weld points`}
        emptyText="No weld points yet"
        className="h-10 text-accent"
      />
      {welds.startedAt !== null && (
        <p className="mt-1 text-3xs text-secondary">
          Since {formatClock(welds.startedAt)} · last {RECENT_WELDS} points
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xs text-secondary">{label}</span>
      <span className="text-xs font-bold tabular-nums">{value}</span>
    </div>
  );
}

//------------------------------------------------------------------------------
const LEVEL_ICON: Record<EventLevel, string> = {
  info: "fa-circle-info text-secondary",
  ok: "fa-circle-check text-positive",
  warn: "fa-triangle-exclamation text-warning",
  error: "fa-circle-xmark text-negative",
};

function EventSection() {
  const events = useEventLog();
  return (
    <section className="px-4 py-3">
      <SectionTitle
        aside={
          events.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-3xs"
              onClick={clearEvents}
            >
              Clear
            </Button>
          )
        }
      >
        Events
      </SectionTitle>
      {events.length === 0 ? (
        <p className="text-3xs text-secondary">Nothing yet.</p>
      ) : (
        <ol className="-mx-1 px-1 space-y-0.5">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2 text-3xs leading-5">
              <TimeAgo
                at={event.at}
                className="text-secondary tabular-nums whitespace-nowrap"
              />
              <Icon
                className={cn("fas mt-1 text-3xs", LEVEL_ICON[event.level])}
              />
              <span className="text-3xs uppercase tracking-wide text-secondary mt-px w-14 shrink-0">
                {event.source}
              </span>
              <span className="min-w-0">
                {event.simulated && (
                  <SourceBadge source="sim" className="mr-1.5 align-[1px]" />
                )}
                {event.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
