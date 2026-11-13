import { useContext, useEffect, useState } from "react";
import { Session } from "@3dverse/livelink";
import { LivelinkContext } from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

import { DisconnectedModal } from "../components/DisconnectedModal";
import { PUBLIC_TOKEN } from "../config";

/**
 * What `Livelink` shows once the connection is lost, or could not be made: the modal that
 * reconnects at the next action.
 *
 * Unless the connection never was and the address names a session: that session may be over, as
 * behind an old invite link, or after everyone left it. Asked first, with the loading screen still
 * up; if it is gone, `onSessionEnded` and no modal, since reconnecting to it could only fail again.
 * A session that was joined and then lost is not asked about: a viewer left idle stays on the
 * modal, and the question comes with the reconnection their next action starts.
 */
export function ConnectionError({
  error,
  sessionId,
  onRetry,
  onSessionEnded,
}: {
  error: string;
  sessionId?: string;
  onRetry: () => void;
  onSessionEnded: () => void;
}) {
  const { instance } = useContext(LivelinkContext);
  const sessionToLookFor = instance ? undefined : sessionId;
  const [isLookingForSession, setIsLookingForSession] = useState(
    Boolean(sessionToLookFor),
  );

  useEffect(() => {
    if (!sessionToLookFor) {
      return;
    }
    let isCancelled = false;
    Session.findById({ session_id: sessionToLookFor, token: PUBLIC_TOKEN })
      .then((session) => {
        if (isCancelled) {
          return;
        }
        if (session) {
          // It is there: what failed is something else, to try again.
          setIsLookingForSession(false);
        } else {
          onSessionEnded();
        }
      })
      .catch(() => {
        // No answer (offline): nothing says the session is over.
        if (!isCancelled) {
          setIsLookingForSession(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [sessionToLookFor, onSessionEnded]);

  if (isLookingForSession) {
    return <LoadingOverlay stage="finding-session" />;
  }
  return <DisconnectedModal error={error} onRetry={onRetry} />;
}
