import { useMemo, useState } from "react";
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

import { authorLabel, useAssist } from "../../assist/assistContext";
import {
  incidentTrace,
  TRACE_SAMPLES,
  TRACE_SECONDS,
} from "../../assist/incidentTrace";
import { INCIDENT_KINDS } from "../../assist/procedures";
import { CAMERA_FEEDS } from "../../config";
import { SourceBadge } from "../common/SourceBadge";
import { Sparkline } from "../common/Sparkline";
import { Row, SectionTitle } from "../supervision/SupervisionPanel";
import { TimeAgo } from "../common/TimeAgo";

/**
 * The incident open, as the expert reads it for the diagnosis: the CN's alarm and the block it
 * stopped on, the trace and the cameras before the stop, the operator's note. Then `children`:
 * the people in the session.
 *
 * The alarm, the block and the trace are SIMULATED until the CN and the cell's recording are
 * connected; the cameras have no recording yet.
 */
export function IncidentPanel({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { incident } = useAssist();
  return (
    <Panel
      className={cn(
        "flex flex-col backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <div className="min-h-0 overflow-y-auto scroll-fade-y divide-y divide-tertiary">
        {incident && <IncidentSections />}
        {children}
      </div>
    </Panel>
  );
}

function IncidentSections() {
  const { incident, store, me } = useAssist();
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const kind = incident?.kind ?? "other";
  const seed = incident?.seed ?? 1;
  const trace = useMemo(() => incidentTrace(kind, seed), [kind, seed]);
  if (!incident) return null;
  const info = INCIDENT_KINDS[incident.kind];

  const close = () => {
    setIsCloseOpen(false);
    if (store && me) {
      store.closeIncident(incident, {
        at: Date.now(),
        by: me,
        outcome: "closed",
      });
    }
  };

  return (
    <>
      <section className="px-4 py-3">
        <SectionTitle aside={<SourceBadge source="sim" />}>
          Incident
        </SectionTitle>
        <p className="mb-1.5 flex items-start gap-1.5 text-2xs text-negative">
          <Icon className="fas fa-triangle-exclamation mt-0.5" />
          {info.alarm}
        </p>
        <div className="space-y-0.5">
          <Row
            label="Program"
            value={<code className="text-3xs">{incident.program || "—"}</code>}
          />
          <Row label="Stopped at" value={`N${incident.block}`} />
          <Row
            label="Opened"
            value={
              <>
                <TimeAgo at={incident.openedAt} /> · {authorLabel(incident.by)}
              </>
            }
          />
        </div>
        {incident.note && (
          <blockquote className="mt-2 border-l-2 border-accent/60 pl-2 text-2xs whitespace-pre-wrap break-words">
            {incident.note}
          </blockquote>
        )}
      </section>

      <section className="px-4 py-3">
        <SectionTitle aside={<SourceBadge source="sim" />}>
          {TRACE_SECONDS} s before the stop
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {trace.map((signal) => (
            <div key={signal.id} className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-2 text-3xs">
                <span className="text-secondary">{signal.label}</span>
                <span className="text-tertiary tabular-nums">
                  {signal.scale[0]}–{signal.scale[1]} {signal.unit}
                </span>
              </div>
              <Sparkline
                values={signal.values}
                length={TRACE_SAMPLES}
                min={signal.scale[0]}
                max={signal.scale[1]}
                band={signal.band}
                label={`${signal.label}, the ${TRACE_SECONDS} s before the stop`}
                emptyText={signal.offText}
                className="h-8 w-full text-accent-300"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-3">
        <SectionTitle
          aside={<SourceBadge source="none" label="No recording" />}
        >
          Cameras at the stop
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {CAMERA_FEEDS.map((feed) => (
            <figure
              key={feed.id}
              className="relative aspect-video overflow-hidden rounded border border-tertiary bg-ground/70 grid place-items-center"
            >
              <Icon className="fas fa-clock-rotate-left text-xs text-tertiary" />
              <figcaption className="absolute inset-x-1 top-1 truncate text-5xs text-secondary">
                {feed.label}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-1.5 text-3xs text-tertiary">
          The replay shows here once the cameras are recorded.
        </p>
      </section>

      <section className="px-4 py-2">
        <Button
          variant="ghost"
          size="xs"
          className="-ml-2 text-3xs text-secondary"
          onClick={() => setIsCloseOpen(true)}
        >
          <Icon className="fas fa-xmark text-5xs" />
          Close without resuming
        </Button>
      </section>

      <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
        <DialogContent className="max-w-md backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Close the incident?</DialogTitle>
            <DialogDescription>
              For a false alarm, or one handled another way. It closes for
              everyone in the session; its steps and notes stay in the log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCloseOpen(false)}
            >
              Keep it open
            </Button>
            <Button variant="outline" size="sm" onClick={close}>
              Close the incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
