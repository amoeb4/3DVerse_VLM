import { useCallback, useState } from "react";

import { useWebXRStore } from "../xr/stores";
import { ConnectionError } from "./ConnectionError";

/**
 * Once the session is lost, the viewer's next action reconnects (`DisconnectedModal`): bumping
 * `Livelink`'s key remounts it, the only way to run its connection again. Out of XR first: a
 * session there only starts from a tap, not from a remount.
 *
 * `connectionAttempt` is that key; `ConnectionErrorPanel`, the panel `Livelink` shows once lost.
 *
 * `sessionId`: the session the address names, when it names one (an invite link, a LIVE tile).
 * Reconnecting to it over and over leads nowhere once it has ended: `onSessionEnded` is then
 * called in place of the modal, for the viewer to open on the machine's own session
 * (`ConnectionError`).
 */
export function useReconnect({
  sessionId,
  onSessionEnded,
}: {
  sessionId?: string;
  onSessionEnded: () => void;
}) {
  const setXRMode = useWebXRStore((state) => state.setXrMode);

  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const retryConnection = useCallback(() => {
    setXRMode(null);
    setConnectionAttempt((attempt) => attempt + 1);
  }, [setXRMode]);

  // Memoized: it is a component type, a new one each render would remount the modal mid-retry.
  const ConnectionErrorPanel = useCallback(
    ({ error }: { error: unknown }) => (
      <ConnectionError
        error={
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "The session was lost."
        }
        sessionId={sessionId}
        onRetry={retryConnection}
        onSessionEnded={onSessionEnded}
      />
    ),
    [retryConnection, sessionId, onSessionEnded],
  );

  return { connectionAttempt, ConnectionErrorPanel };
}
