import { useState } from "react";
import { DOM3DAnchor, DOM3DOverlay } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../../assist/assistContext";
import type { Pin } from "../../assist/assistStore";
import { ROLE_LABELS } from "../../assist/procedures";
import { colorFromClientId } from "../../utils/clientColor";
import { EXPERT_COLOR, EXPERT_NAME } from "../../assist/participantLook";
import type { Author } from "../../assist/assistStore";
import { TimeAgo } from "../common/TimeAgo";

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

function Stem({ color }: { color: string }) {
  return (
    <>
      <span className="w-px h-4" style={{ background: color }} />
      <span
        className="size-2.5 rounded-full ring-2 ring-white/80"
        style={{ background: color }}
      />
    </>
  );
}

function PinMarker({ pin }: { pin: Pin }) {
  const { store } = useAssist();
  const color = colorOf(pin.by);
  return (
    <div className="group flex flex-col items-center pointer-events-auto">
      <div
        className="relative max-w-56 rounded-lg border-2 bg-ground/85 backdrop-blur-md px-2.5 py-1.5 shadow-lg"
        style={{ borderColor: color }}
      >
        <p className="text-2xs whitespace-pre-wrap break-words pr-3">
          {pin.text}
        </p>
        <p className="text-5xs text-secondary whitespace-nowrap">
          {pin.by.role === "expert" ? EXPERT_NAME : pin.by.name}
          {pin.by.role === "operator" && ` · ${ROLE_LABELS.operator}`} ·{" "}
          <TimeAgo at={pin.at} />
        </p>
        <button
          type="button"
          className={cn(
            "absolute top-0.5 right-0.5 size-4 grid place-items-center rounded text-secondary",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-primary",
          )}
          title="Remove the note, for everyone"
          aria-label="Remove the note"
          onClick={() => void store?.removePin(pin)}
        >
          <Icon className="fas fa-xmark text-5xs" />
        </button>
      </div>
      <Stem color={color} />
    </div>
  );
}

function PinComposer() {
  const { store, me, incident, pinDraft, cancelPin } = useAssist();
  const [text, setText] = useState("");
  const color = me ? colorOf(me) : "white";

  const submit = () => {
    const trimmed = text.trim();
    if (!store || !me || !pinDraft || !trimmed) return;
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
      <div
        className="flex flex-col gap-1.5 w-60 rounded-lg border-2 bg-ground/90 backdrop-blur-md p-2 shadow-lg"
        style={{ borderColor: color }}
      >
        <input
          autoFocus
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          placeholder="The note, for everyone"
          aria-label="The note"
          className="w-full px-2 py-1 border border-secondary bg-ground text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-accent"
        />
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={cancelPin}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="accent"
            size="xs"
            className="text-white!"
            disabled={!text.trim()}
          >
            Pin
          </Button>
        </div>
      </div>
      <Stem color={color} />
    </form>
  );
}
