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
  DotPing,
  Icon,
  Panel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
} from "@3dverse/ui-lib";
import { PanelTitle } from "../common/PanelTitle";

import { authorLabel, useAssist } from "../../assist/assistContext";
import { INCIDENT_KINDS } from "../../assist/procedures";
import { useActorName } from "../../hooks/useActorName";
import { logEvent } from "../../live/eventLog";
import { formatClock } from "../../live/format";
import {
  applyCorrections,
  CORRECTION_LIMITS,
  holdSimulation,
  simulateOnSiteStart,
  useProcessFeed,
  type Corrections,
} from "../../live/processFeed";
import { SourceBadge } from "../common/SourceBadge";

const CORRECTION_KEYS = Object.keys(CORRECTION_LIMITS) as (keyof Corrections)[];

const formatCorrection = (key: keyof Corrections, value: number) => {
  const { unit, step } = CORRECTION_LIMITS[key];
  const decimals = step < 1 ? 1 : 0;
  const signed = key === "arcLength" || key === "dynamics";
  const text = `${signed && value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
  return unit ? `${text} ${unit}` : text;
};

/**
 * What one can do on the cell, in every mode: stop it (E-Stop), get assistance, and adjust the
 * process inside its bounds (arc-length correction, arc dynamics, wire speed, feed override).
 *
 * Adjusting and stopping are LOGGED ONLY for now: written to the event log, with who did it and
 * when, and never sent to the machine. On the simulation, the simulated process responds, so a
 * demo shows the loop. Resuming after a stop is never remote: it is NC Start at the machine.
 *
 * The E-Stop is a remote stop REQUEST (NC Stop, feed hold), not a safety function: the safety-rated
 * emergency stop stays the hardwired button at the cell (EN ISO 13850). Its dialog says so.
 *
 * Assistance leads to the Assistance mode: to its Diagnostic, where the cell is looked at before
 * an incident is opened or an expert asked for; once an incident is open, to its recovery. In the
 * Assistance mode itself (`inAssistance`) it is disabled, and the panel holds `children` below the
 * actions: who is in the session.
 */
export function RemoteActions({
  onOpenAssistance,
  inAssistance = false,
  children,
  className,
}: {
  /** To the Assistance mode: its Diagnostic, or the open incident's recovery. */
  onOpenAssistance: () => void;
  /** Shown in the Assistance mode: its button has nowhere else to lead. */
  inAssistance?: boolean;
  /** Below the actions, in a section of its own (Assistance: who is in the session). */
  children?: React.ReactNode;
  className?: string;
}) {
  const process = useProcessFeed(500);
  const actor = useActorName();
  const { incident } = useAssist();
  const [isStopOpen, setIsStopOpen] = useState(false);
  const isSim = process.source === "sim";
  const isHeld = process.cn.state === "hold";

  const confirmStop = () => {
    logEvent(
      "warn",
      "action",
      `${actor} pressed E-Stop: stop requested (NC Stop) · logged only, not sent`,
    );
    holdSimulation();
    setIsStopOpen(false);
  };

  return (
    <Panel
      className={cn(
        "flex flex-col gap-2 px-3 py-2 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 mb-1">
        <PanelTitle>Remote actions</PanelTitle>
        <SourceBadge source="none" label="Logged only" />
      </header>

      <div className="flex flex-wrap gap-x-2 gap-y-3">
        {/* The E-Stop, first and full width: the one action that must never be hunted for. */}
        {isHeld ? (
          <Button
            variant="outline"
            className="w-full font-bold tracking-wider uppercase text-negative border-negative/60"
            disabled
            title="On hold: resume with NC Start at the machine"
          >
            <Icon className="fas fa-circle-pause text-xs" />
            Stopped · on hold
          </Button>
        ) : (
          <Button
            variant="destructive"
            className={cn(
              "w-full font-bold tracking-wider uppercase bg-negative/90! text-white!",
              "outline outline-offset-2 outline-negative/40 shadow-none",
              "hover:shadow-[0_0_10px_var(--color-negative)] transition-shadow",
            )}
            title="E-Stop: request a stop of the cell (NC Stop) · logged only"
            onClick={() => setIsStopOpen(true)}
          >
            <Icon className="fas fa-hand text-xs" />
            E-Stop
          </Button>
        )}

        {inAssistance ? (
          <Button
            variant="outline"
            className="grow text-accent-300"
            disabled
            title="You are in the Diagnostic"
          >
            <Icon className="fas fa-stethoscope text-2xs" />
            Diagnostic
          </Button>
        ) : incident ? (
          <Button
            variant="outline"
            className="grow text-warning"
            title={`${authorLabel(incident.by)} asked for help: ${INCIDENT_KINDS[incident.kind].label}. Open its recovery.`}
            onClick={onOpenAssistance}
          >
            <DotPing isActive className="text-warning" />
            Diagnostic
          </Button>
        ) : (
          <Button
            variant="outline"
            className="grow text-white bg-accent border-accent"
            title="Diagnostic: look at the cell, run the checks, or ask an expert"
            onClick={onOpenAssistance}
          >
            <Icon className="fas fa-stethoscope text-2xs" />
            Diagnostic
          </Button>
        )}
        <AdjustProcess
          corrections={process.corrections}
          actor={actor}
          disabled={isHeld}
        />
      </div>

      {isHeld ? (
        <p className="text-4xs text-negative">
          On hold
          {process.cn.heldAt !== null &&
            ` since ${formatClock(process.cn.heldAt)}`}
          . Resume with NC Start at the machine.
          {isSim && (
            <Button
              variant="link"
              size="xs"
              className="ml-1 text-4xs"
              onClick={simulateOnSiteStart}
            >
              Simulate NC Start at the machine
            </Button>
          )}
        </p>
      ) : (
        <p className="text-4xs text-tertiary">
          Nothing is sent to the machine yet: adjusting and stopping go to the
          event log{isSim && ", and act on the simulated process"}.
        </p>
      )}

      {children && (
        <div className="-mx-3 -mb-2.5 mt-0.5 border-t border-tertiary">
          {children}
        </div>
      )}

      <Dialog open={isStopOpen} onOpenChange={setIsStopOpen}>
        <DialogContent className="max-w-lg backdrop-blur-xl text-balance">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">E-Stop: stop the cell?</DialogTitle>
            <DialogDescription>
              This asks the CN to stop (NC Stop, feed hold): the robot stops on
              its path and the arc goes off. Resuming needs NC Start at the
              machine.
            </DialogDescription>
          </DialogHeader>
          <p className="text-2xs text-negative">
            A remote stop request, not a safety function: the safety-rated
            emergency stop is the hardwired button at the cell.
          </p>
          <p className="text-2xs text-warning">
            Logged only: in this version the request is not sent to the machine.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsStopOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="font-bold uppercase"
              onClick={confirmStop}
            >
              <Icon className="fas fa-hand text-2xs" />
              E-Stop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

//------------------------------------------------------------------------------
/** The process settings, in two steps: set them, then review and confirm the changes. */
function AdjustProcess({
  corrections,
  actor,
  disabled,
  className,
}: {
  corrections: Corrections;
  actor: string;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [draft, setDraft] = useState(corrections);

  const changes = CORRECTION_KEYS.filter(
    (key) => Math.abs(draft[key] - corrections[key]) > 1e-6,
  );

  const onOpenChange = (open: boolean) => {
    if (open) {
      setDraft(corrections);
      setIsReviewing(false);
    }
    setIsOpen(open);
  };

  const confirm = () => {
    for (const key of changes) {
      logEvent(
        "info",
        "action",
        `${actor} set ${CORRECTION_LIMITS[key].label.toLowerCase()} ${formatCorrection(key, corrections[key])} → ${formatCorrection(key, draft[key])} · logged only, not sent`,
      );
    }
    applyCorrections(
      Object.fromEntries(changes.map((key) => [key, draft[key]])),
    );
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            active={isOpen}
            disabled={disabled}
            className={cn("px-4", className)}
          />
        }
      >
        Adjust process
      </PopoverTrigger>
      {/* The panel stands top right: under it, towards the middle. */}
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 border border-tertiary"
      >
        <div className="flex flex-col gap-3 p-3 text-2xs">
          <header className="flex items-center justify-between gap-2">
            <PanelTitle>
              {isReviewing ? "Confirm the changes" : "Adjust process"}
            </PanelTitle>
            <SourceBadge source="none" label="Logged only" />
          </header>

          {isReviewing ? (
            <ul className="space-y-1">
              {changes.map((key) => (
                <li key={key} className="flex justify-between gap-3">
                  <span className="text-secondary">
                    {CORRECTION_LIMITS[key].label}
                  </span>
                  <span className="tabular-nums">
                    {formatCorrection(key, corrections[key])} →{" "}
                    <b>{formatCorrection(key, draft[key])}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            CORRECTION_KEYS.map((key) => {
              const { label, min, max, step } = CORRECTION_LIMITS[key];
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <span>{label}</span>
                    <span className="tabular-nums text-accent-300">
                      {formatCorrection(key, draft[key])}
                    </span>
                  </div>
                  <Slider
                    min={min}
                    max={max}
                    step={step}
                    value={draft[key]}
                    onValueChange={(value) =>
                      setDraft((previous) => ({ ...previous, [key]: value }))
                    }
                    aria-label={label}
                    size="2xs"
                    className="[&_output]:text-white"
                  />
                  <div className="flex justify-between text-5xs text-tertiary tabular-nums">
                    <span>{formatCorrection(key, min)}</span>
                    <span>{formatCorrection(key, max)}</span>
                  </div>
                </div>
              );
            })
          )}

          <p className="text-3xs text-secondary">
            Bounded by the welding procedure (WPS). Not sent to the machine in
            this version.
          </p>

          <footer className="flex justify-end gap-2">
            {isReviewing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReviewing(false)}
                >
                  Back
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  className="text-white!"
                  onClick={confirm}
                >
                  Confirm {changes.length}{" "}
                  {changes.length === 1 ? "change" : "changes"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  className="text-white!"
                  disabled={changes.length === 0}
                  onClick={() => setIsReviewing(true)}
                >
                  Review
                </Button>
              </>
            )}
          </footer>
        </div>
      </PopoverContent>
    </Popover>
  );
}
