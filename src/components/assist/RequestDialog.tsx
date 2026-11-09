import { useEffect, useState } from "react";
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

import { useAssist } from "../../assist/assistContext";
import {
  INCIDENT_KIND_IDS,
  INCIDENT_KINDS,
  type IncidentKind,
} from "../../assist/procedures";
import { useProcessFeed } from "../../live/processFeed";
import { SourceBadge } from "../common/SourceBadge";

/**
 * Opening an incident: what happened, and a note. Everyone in the session sees it at once, with its
 * recovery. The CN's program and block are taken as they are now (simulated until the CN is
 * connected). `initialKind`: what the Diagnostic found happened, picked when it opens. `onSent`:
 * once the incident is open (the header's "Ask an expert" then goes to Assistance).
 */
export function RequestDialog({
  open,
  onOpenChange,
  initialKind,
  initialNote,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: IncidentKind;
  /** The note it opens with (e.g. what the diagnostic found), still editable. */
  initialNote?: string;
  onSent?: () => void;
}) {
  const { store, me, role } = useAssist();
  const process = useProcessFeed(1000);
  const [kind, setKind] = useState<IncidentKind>("torch-collision");
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isOperator = role === "operator";

  useEffect(() => {
    if (open && initialKind) {
      setKind(initialKind);
    }
    if (open && initialNote !== undefined) {
      setNote(initialNote);
    }
  }, [open, initialKind, initialNote]);

  const submit = async () => {
    if (!store || !me || isSending) return;
    setIsSending(true);
    try {
      await store.openIncident({
        kind,
        note: note.trim(),
        openedAt: Date.now(),
        by: me,
        program: process.cn.program,
        block: process.cn.block,
      });
      setNote("");
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      console.error("Assistance: cannot open the incident", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-ground/80 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>
            {isOperator ? "Request assistance" : "Open an incident"}
          </DialogTitle>
          <DialogDescription>
            Everyone in the session sees it at once, with its recovery steps.
            {isOperator && " Make the cell safe first."}
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="What happened"
          className="grid grid-cols-3 gap-2"
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
                  "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-2xs transition-colors",
                  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
                  isChecked
                    ? "border-accent bg-accent/15 text-primary"
                    : "border-tertiary text-secondary hover:border-secondary",
                )}
              >
                <Icon className={cn("fas text-sm", info.icon)} />
                {info.label}
              </button>
            );
          })}
        </div>

        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-secondary">
            What did you see or hear? (optional)
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={400}
            placeholder="E.g. a bang at the start of layer 42, the torch is bent"
            className="w-full px-3 py-2 border border-secondary bg-ground text-xs rounded-xl [corner-shape:squircle] resize-none focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
        </label>

        <p className="flex items-center gap-1.5 text-3xs text-secondary">
          <SourceBadge source="sim" />
          The alarm and the block are simulated until the CN is connected.
        </p>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            className="text-white!"
            disabled={!store || !me || isSending}
            onClick={() => void submit()}
          >
            <Icon className="fas fa-life-ring text-2xs" />
            {isOperator ? "Request assistance" : "Open the incident"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
