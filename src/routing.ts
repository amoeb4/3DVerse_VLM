import { MACHINES } from "./config";

// The app's URLs:
//   /                          the machine gallery
//   /<slug>                    a machine's viewer, e.g. /nj130-2.05 (joins its running session, if any)
//   /<scene UUID>              the viewer on any other scene
//   …?sessionId=<id>           the viewer joining that very session (invite links, LIVE tiles)

export const HOME_PATH = "/";

/** Names the session to join, so a link can put someone in the same session as you. */
export const SESSION_ID_PARAM = "sessionId";

/**
 * Invite links made before the app had URLs (`/?sessionId=…&sceneId=…`) named the scene in the
 * query; the path does now. Only read, to send those links on to the machine's URL.
 */
export const LEGACY_SCENE_ID_PARAM = "sceneId";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The scene a viewer URL opens. */
export type ViewerScene = {
  sceneId: string;
  /** Shown in the viewer's header and the tab title. */
  name: string;
  /** The URL's path segment for it: the machine's slug, or the scene UUID. */
  segment: string;
};

/**
 * What `/<segment>` opens: the machine with that slug (in any case) or that scene UUID, else the
 * scene with that UUID. `null` for anything else.
 */
export function resolveViewerScene(segment: string): ViewerScene | null {
  const key = segment.toLowerCase();
  const machine = MACHINES.find(
    (m) => m.slug === key || m.sceneId.toLowerCase() === key,
  );
  if (machine) {
    return {
      sceneId: machine.sceneId,
      name: machine.name,
      segment: machine.slug,
    };
  }
  if (UUID_RE.test(segment)) {
    return { sceneId: segment, name: "Custom scene", segment };
  }
  return null;
}

/**
 * The URL of the viewer on a machine (by slug) or scene (by UUID): the machine's own URL whenever
 * the scene is one of `MACHINES`, so every way in lands on the same address.
 */
export function viewerPath(slugOrSceneId: string, sessionId?: string): string {
  const segment =
    resolveViewerScene(slugOrSceneId)?.segment ??
    encodeURIComponent(slugOrSceneId);
  const search = sessionId
    ? `?${new URLSearchParams({ [SESSION_ID_PARAM]: sessionId })}`
    : "";
  return `/${segment}${search}`;
}
