import { useState } from "react";
import { Button, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";
import { RequestDialog } from "./RequestDialog";

/**
 * "Ask an expert", in the header, from any mode: opens the request (what happened, a note) — an
 * incident everyone in the session sees, VLM's experts included — then goes to Assistance, to
 * follow its recovery. Once an incident is open, the expert has been asked: it goes straight to
 * Assistance. Not shown to the expert themselves (`?role=expert`).
 */
export function AskExpertButton({
  onOpenAssistance,
}: {
  /** To the Assistance mode. */
  onOpenAssistance: () => void;
}) {
  const { role, incident } = useAssist();
  const [isOpen, setIsOpen] = useState(false);

  if (role === "expert") return null;

  return (
    <>
      <Button
        variant="accent"
        round
        // VLM's purple whatever the mode: Training's accent does not reach it (index.css).
        data-accent="brand"
        className="relative pr-4 text-white! outline-none"
        title={
          incident
            ? "An expert has been asked: open the incident's recovery"
            : "Ask a VLM expert for help: describe what happened"
        }
        onClick={() => (incident ? onOpenAssistance() : setIsOpen(true))}
      >
        <Icon className="fas fa-headset text-2xs translate-y-px" />
        <span className="hidden lg:block">Ask an expert</span>
      </Button>
      <RequestDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        initialKind="torch-collision"
        onSent={onOpenAssistance}
      />
    </>
  );
}
