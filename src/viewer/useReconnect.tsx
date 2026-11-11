import { useCallback, useState } from "react";

import { DisconnectedModal } from "../components/DisconnectedModal";
import { useWebXRStore } from "../xr/stores";

/**
 * Once the session is lost, the viewer's next action reconnects (`DisconnectedModal`): bumping
 * `Livelink`'s key remounts it, the only way to run its connection again. Out of XR first: a
 * session there only starts from a tap, not from a remount.
 *
 * `connectionAttempt` is that key; `ConnectionErrorPanel`, the panel `Livelink` shows once lost.
 */
export function useReconnect() {
  const setXRMode = useWebXRStore((state) => state.setXrMode);

  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const retryConnection = useCallback(() => {
    setXRMode(null);
    setConnectionAttempt((attempt) => attempt + 1);
  }, [setXRMode]);

  // Memoized: it is a component type, a new one each render would remount the modal mid-retry.
  const ConnectionErrorPanel = useCallback(
    ({ error }: { error: unknown }) => (
      <DisconnectedModal
        error={
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "The session was lost."
        }
        onRetry={retryConnection}
      />
    ),
    [retryConnection],
  );

  return { connectionAttempt, ConnectionErrorPanel };
}
