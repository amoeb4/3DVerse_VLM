import { useEffect, useState } from "react";

import { PUBLIC_TOKEN } from "../../config";

const API_URL = "https://api.3dverse.com/app/v1";
const POLL_INTERVAL_MS = 15_000;

export type LiveSession = {
  sessionId: string;
  sceneId: string;
  createdAt: string;
  /** Raw platform usernames of the clients connected right now. */
  usernames: string[];
};

type RunningSession = {
  session_id: string;
  scene_id: string;
  created_at: string;
  is_transient_session?: boolean;
  clients?: { username?: string }[];
};

/**
 * The 3dverse sessions running right now, grouped by scene — what the startup page's LIVE badges
 * show. Polled while the page is open, and paused while the tab is hidden.
 *
 * `available` is false when the platform could not be asked (offline, token refused): the badges
 * then stay out of the way rather than claiming every machine is idle.
 */
export function useLiveSessions() {
  const [byScene, setByScene] = useState<Map<string, LiveSession[]>>(new Map());
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(`${API_URL}/sessions`, {
            headers: { user_token: PUBLIC_TOKEN },
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const sessions = (await response.json()) as RunningSession[];
          const next = new Map<string, LiveSession[]>();
          for (const session of sessions) {
            // The tiles' 3D previews (`MachinePreview`), not someone at work on the machine. The
            // viewer only ever opens persistent sessions, so a transient one is never one to join.
            if (session.is_transient_session) {
              continue;
            }
            const live: LiveSession = {
              sessionId: session.session_id,
              sceneId: session.scene_id,
              createdAt: session.created_at,
              usernames: (session.clients ?? [])
                .map((client) => client.username ?? "")
                .filter(Boolean),
            };
            next.set(session.scene_id, [
              ...(next.get(session.scene_id) ?? []),
              live,
            ]);
          }
          if (!cancelled) {
            setByScene(next);
            setAvailable(true);
          }
        } catch (error) {
          console.warn("Could not list the running sessions", error);
          if (!cancelled) {
            setAvailable(false);
          }
        }
      }
      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return { byScene, available };
}
