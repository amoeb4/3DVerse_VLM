import { useContext } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";

import { AssistContext } from "../assist/assistContext";
import { displayNameOf } from "../utils/clientName";

/**
 * The name the event log gives whoever acted from this viewer: "VLM Expert" while they are the
 * expert in Assistance (their `me`), their own name otherwise.
 */
export function useActorName() {
  const { instance } = useContext(LivelinkContext);
  const me = useContext(AssistContext)?.me;
  return me?.name ?? displayNameOf(instance?.session.current_client?.username);
}
