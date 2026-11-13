import { useState } from "react";
import { DOM3DAnchor, DOM3DOverlay } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";
import type { Pin } from "../../assist/assistStore";
import { ROLE_LABELS } from "../../assist/procedures";
import { colorFromClientId } from "../../utils/clientColor";
import { EXPERT_COLOR, EXPERT_NAME } from "../../assist/participantLook";
import type { Author } from "../../assist/assistStore";
import { TimeAgo } from "../common";
import { triggerHapticFeedback } from "../../utils/haptics";

/** An author's colour: an expert's is the accent (`participantLook`). */
const colorOf = (author: Pick<Author, "clientId" | "role">) =>
  author.role === "expert" ? EXPERT_COLOR : colorFromClientId(author.clientId);

/**
 * The notes pinned on the cell, where they were pinned, for everyone in the session: those of the
 * incident open, and those pinned outside any. And the note being written, at the point clicked.
 *
 * Must be rendered inside the `Viewport`.
 */
export function AssistPins() {
  const { snapshot, incident, pinDraft } = useAssist();
  const pins = snapshot.pins.filter(
    ({ incidentId }) => incidentId === null || incidentId === incident?.id,
  );
  if (pins.length === 0 && !pinDraft) return null;

  return (
    <DOM3DOverlay>
      {pins.map((pin) => (
        <DOM3DAnchor
          key={pin.entityId}
          worldPosition={pin.position}
          offset="center-bottom"
        >
          <PinMarker pin={pin} />
        </DOM3DAnchor>
      ))}
      {pinDraft && (
        <DOM3DAnchor worldPosition={pinDraft} offset="center-bottom">
          <PinComposer />
        </DOM3DAnchor>
      )}
    </DOM3DOverlay>
  );
}

/** From the card down to the point the note is on, in the notes' colour: the informative one. */
function Stem() {
  return (
    <>
      <span className="w-px h-4 bg-informative" />
      <span className="size-2.5 rounded-full bg-informative ring-2 ring-white/80" />
    </>
  );
}

function PinMarker({ pin }: { pin: Pin }) {
  const { store } = useAssist();
  return (
    <div className="group flex flex-col items-center pointer-events-auto">
      <div className="relative min-w-48 max-w-56 rounded-lg border-2 border-informative bg-ground/85 backdrop-blur-md px-2.5 py-1.5 shadow-lg">
        <p className="text-2xs whitespace-pre-wrap break-words pr-3">
          {pin.text}
        </p>
        <p className="flex items-center gap-1 text-5xs text-secondary whitespace-nowrap">
          {/* Who wrote it, in their colour (`participantLook`). */}
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: colorOf(pin.by) }}
          />
          {pin.by.role === "expert" ? EXPERT_NAME : pin.by.name}
          {pin.by.role === "operator" && ` · ${ROLE_LABELS.operator}`} ·{" "}
          <TimeAgo at={pin.at} />
        </p>
        <button
          type="button"
          className={cn(
            "absolute top-0.5 right-0.5 size-4 grid place-items-center rounded text-secondary cursor-pointer",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-primary",
          )}
          title="Remove the note"
          aria-label="Remove the note"
          onClick={() => void store?.removePin(pin)}
        >
          <Icon className="fas fa-xmark text-5xs" />
        </button>
      </div>
      <Stem />
    </div>
  );
}

function PinComposer() {
  const { store, me, incident, pinDraft, cancelPin } = useAssist();
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!store || !me || !pinDraft || !trimmed) return;
    triggerHapticFeedback();
    void store.addPin(pinDraft, {
      incidentId: incident?.id ?? null,
      text: trimmed,
      at: Date.now(),
      by: me,
    });
    cancelPin();
  };

  return (
    <form
      className="flex flex-col items-center pointer-events-auto"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-1.5 w-60 rounded-lg border-2 border-informative bg-ground/90 backdrop-blur-md p-1 shadow-lg">
        <input
          autoFocus
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a note..."
          aria-label="The note"
          className="w-full px-2 py-1 text-xs bg-transparent border-none outline-none caret-informative"
        />
        <div className="flex justify-end gap-1 p-1 pt-0">
          <Button type="button" variant="ghost" size="xs" onClick={cancelPin}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="accent"
            size="xs"
            className="bg-informative hover:bg-informative/90"
            disabled={!text.trim()}
          >
            Add note
          </Button>
        </div>
      </div>
      <Stem />
    </form>
  );
}
