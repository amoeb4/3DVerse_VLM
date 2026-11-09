import { createContext, useContext } from "react";
import type { Vec3 } from "@3dverse/livelink";

import type {
  AssistSnapshot,
  AssistStore,
  Author,
  Incident,
} from "./assistStore";
import type { AssistRole } from "./procedures";

export type AssistContextValue = {
  /** `null` until the session is there. */
  store: AssistStore | null;
  snapshot: AssistSnapshot;
  /** The incident being worked on. */
  incident: Incident | null;
  /** This viewer, as the others see it. */
  me: Author | null;
  role: AssistRole | null;
  setRole: (role: AssistRole | null) => void;

  /** The step this viewer points the others to. */
  pointing: string | null;
  pointTo: (stepId: string | null) => void;

  /** Placing a note: the next click on the cell says where. */
  isPlacingPin: boolean;
  /** Where the note being written goes. */
  pinDraft: Vec3 | null;
  startPin: () => void;
  cancelPin: () => void;

  /** The participant whose camera this viewer's follows. */
  following: string | null;
  setFollowing: (clientId: string | null) => void;
};

export const AssistContext = createContext<AssistContextValue | null>(null);

/** The assistance session. Under `AssistProvider`. */
export function useAssist(): AssistContextValue {
  const value = useContext(AssistContext);
  if (!value) {
    throw new Error("useAssist must be used under an AssistProvider");
  }
  return value;
}

/**
 * A participant as the event log and the cards name them: "Marie (Operator)"; an expert is
 * "VLM Expert", which says the role already.
 */
export const authorLabel = (author: Author) =>
  author.role === "expert"
    ? "VLM Expert"
    : author.role
      ? `${author.name} (Operator)`
      : author.name;
