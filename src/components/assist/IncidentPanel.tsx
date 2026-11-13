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
} from "@3dverse/ui-lib";
import { Panel } from "../common/Panel";

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
import { Row } from "../common/Row";
import { TimeAgo } from "../common/TimeAgo";
import {
  PanelTitle,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "../common/Section";

/**
 * The incident open, as the expert reads it for the diagnosis: the CN's alarm and the block it
 * stopped on, the trace and the cameras before the stop, the operator's note. Then `children`.
 * At its foot, always in view: closing it without resuming.
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
    <Panel variant="glass" className={cn("flex flex-col", className)}>
      <div className="min-h-0 overflow-y-auto scroll-fade-y divide-y divide-tertiary">
        {incident && <IncidentSections />}
        {children}
      </div>
      {incident && <CloseIncident />}
    </Panel>
  );
}

function IncidentSections() {
  const { incident } = useAssist();
  const kind = incident?.kind ?? "other";
  const seed = incident?.seed ?? 1;
  const trace = useMemo(() => incidentTrace(kind, seed), [kind, seed]);
  if (!incident) return null;
  const info = INCIDENT_KINDS[incident.kind];

  return (
    <>
      <section>
        <SectionHeader aside={<SourceBadge source="sim" />}>
          <PanelTitle>Incident</PanelTitle>
        </SectionHeader>
        <p className="flex items-start gap-1.5 px-4 py-2 text-2xs text-negative text-pretty bg-negative/15">
          <Icon className="fas fa-triangle-exclamation text-5xs mt-1" />
          {info.alarm}
        </p>

        <SectionBody className="space-y-0.5 pt-3">
          <Row label="Program" value={<code>{incident.program || "—"}</code>} />
          <Row label="Stopped at" value={`N${incident.block}`} />
          <Row
            label="Opened"
            value={
              <>
                <TimeAgo at={incident.openedAt} /> · {authorLabel(incident.by)}
              </>
            }
          />

          {incident.note && (
            <blockquote className="mt-2 border-l-2 border-accent pl-2 text-3xs whitespace-pre-wrap break-words bg-accent/5 text-balance">
              {incident.note}
            </blockquote>
          )}
        </SectionBody>
      </section>

      <section>
        <SectionHeader aside={<SourceBadge source="sim" />}>
          <SectionTitle>{TRACE_SECONDS} s before the stop</SectionTitle>
        </SectionHeader>
        <SectionBody className="flex flex-col gap-2">
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
        </SectionBody>
      </section>

      <section>
        <SectionHeader
          aside={<SourceBadge source="none" label="No recording" />}
        >
          <SectionTitle>Cameras at the stop</SectionTitle>
        </SectionHeader>
        <SectionBody>
          <div className="grid grid-cols-2 gap-2">
            {CAMERA_FEEDS.map((feed) => (
              <figure
                key={feed.id}
                className="relative aspect-video overflow-hidden rounded border border-tertiary bg-ground/70 grid place-items-center"
              >
                <Icon className="fas fa-clock-rotate-left pt-3 text-xs text-tertiary" />
                <figcaption className="absolute inset-x-1 top-1 truncate text-5xs text-secondary">
                  {feed.label}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-1.5 text-5xs leading-tight text-tertiary text-balance">
            The replay shows here once the cameras are recorded.
          </p>
        </SectionBody>
      </section>
    </>
  );
}

/** The incident's way out, highlighted at the panel's foot, behind a confirmation. */
function CloseIncident() {
  const { incident, store, me } = useAssist();
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  if (!incident) return null;

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
      <footer className="shrink-0 px-4 py-3 border-t border-tertiary">
        <Button
          variant="accent"
          className="w-full justify-center text-white!"
          onClick={() => setIsCloseOpen(true)}
        >
          <Icon className="fas fa-xmark text-2xs" />
          Close without resuming
        </Button>
      </footer>

      <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close the incident?</DialogTitle>
            <DialogDescription>
              For a false alarm, or one handled another way. It closes for
              everyone in the session; its steps and notes stay in the log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseOpen(false)}>
              Keep it open
            </Button>
            <Button variant="accent" onClick={close} className="text-white!">
              Close the incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
