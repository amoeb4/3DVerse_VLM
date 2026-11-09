import { useContext } from "react";
import { LivelinkContext, useClients } from "@3dverse/livelink-react";

/**
 * Whether this viewer leads the session: of the people in it, the one with the smallest client id.
 * Every viewer comes to the same answer, so exactly one of them does what must happen once for the
 * whole session (the machine's weld, written into the shared scene). Elected again as people come
 * and go. Headless API clients (scripts, bridges) never lead: they run none of this.
 */
export function useIsSessionLead(): boolean {
  const { instance } = useContext(LivelinkContext);
  // Re-renders as clients join and leave.
  const { clients } = useClients();
  const self = instance?.session.client_id;
  if (!self) {
    return false;
  }
  return clients
    .filter((client) => client.client_type !== "api")
    .every((client) => client.id >= self);
}
