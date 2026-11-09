import { useCallback, useContext } from "react";

import { colorFromClientId } from "../utils/clientColor";
import { displayNameOf, initialsOf } from "../utils/clientName";
import { AssistContext } from "./assistContext";
import type { AssistRole } from "./procedures";

/**
 * How a participant shows, wherever they do (3D avatar, header bubbles, who is in the session,
 * pinned notes): their name, colour and initials. An expert shows as VLM's: "VLM Expert", in the
 * app's accent colour, a headset instead of initials — whoever the expert is, the operator sees
 * VLM's support.
 */
export const EXPERT_NAME = "VLM Expert";
/** The accent, as a CSS colour: it follows the theme's accent scale. */
export const EXPERT_COLOR = "var(--color-accent)";

export type ParticipantLook = {
  name: string;
  /** A CSS colour. */
  color: string;
  isExpert: boolean;
  /** Two letters; an expert shows `ParticipantMark`'s headset instead. */
  initials: string;
};

export function participantLook({
  clientId,
  username,
  role,
}: {
  clientId: string;
  /** The platform username, raw. */
  username?: string | null;
  role: AssistRole | null;
}): ParticipantLook {
  if (role === "expert") {
    return {
      name: EXPERT_NAME,
      color: EXPERT_COLOR,
      isExpert: true,
      initials: "",
    };
  }
  return {
    name: displayNameOf(username),
    color: colorFromClientId(clientId),
    isExpert: false,
    initials: initialsOf(username),
  };
}

/**
 * `look(clientId, username)`: how a participant of this session shows, by the role they are in
 * Assistance (their presence) — this viewer by its own role. Works outside an `AssistProvider`
 * too, where nobody has a role.
 */
export function useParticipantLook() {
  const assist = useContext(AssistContext);
  const presences = assist?.snapshot.presences;
  const me = assist?.me;
  const myRole = assist?.role ?? null;

  return useCallback(
    (clientId: string, username?: string | null) => {
      const role =
        clientId === me?.clientId
          ? myRole
          : (presences?.find((presence) => presence.clientId === clientId)
              ?.role ?? null);
      // This viewer: its own name, when no username is given.
      const name =
        username ?? (clientId === me?.clientId ? me?.name : undefined);
      return participantLook({ clientId, username: name, role });
    },
    [presences, me?.clientId, me?.name, myRole],
  );
}
