import { useCallback, useContext } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
// Ported from 3dverse-mobile-viewer `apps/common/clientName.ts`.
//------------------------------------------------------------------------------
/**
 * A client's username, as the platform gives it, is a path rather than a name:
 * `org_project_environment_username`, with the person's own name last. That last part is what the
 * app shows; the rest says where the client comes from.
 */
export type ClientName = {
  /** The username as the platform gives it, whole. */
  readonly raw: string;
  readonly org: string;
  readonly project: string;
  readonly environment: string;
  /** The person's own name: the one to show. */
  readonly username: string;
};

//------------------------------------------------------------------------------
/** What a client without a name — a guest, say — is called. */
export const GUEST_NAME = "Guest";

/** What the platform calls whoever joins with a public token, and what the app shows instead. */
const PUBLIC_USERNAME = "public_user";
export const PUBLIC_USER_NAME = "User";

/** A person's name as the app shows it: the platform's `public_user` is `User`. */
export const shownName = (name: string): string =>
  name.toLowerCase() === PUBLIC_USERNAME ? PUBLIC_USER_NAME : name;

const SEPARATOR = "_";
/** `org`, `project` and `environment`: everything after them is the username. */
const PREFIX_LENGTH = 3;

//------------------------------------------------------------------------------
// Each username is split once. A client keeps its username for the whole session, so the cache
// stays as small as the roster, and a name keeps the same object from one render to the next.
const parsedNames = new Map<string, ClientName>();

//------------------------------------------------------------------------------
/**
 * The parts of a platform username. The username part may contain underscores itself: everything
 * after the third one belongs to it. A name that is not in that form is kept whole as the username.
 */
export function parseClientName(raw: string): ClientName {
  let name = parsedNames.get(raw);
  if (!name) {
    name = splitClientName(raw);
    parsedNames.set(raw, name);
  }
  return name;
}

function splitClientName(raw: string): ClientName {
  const parts = raw.split(SEPARATOR);
  const username = parts.slice(PREFIX_LENGTH).join(SEPARATOR);
  if (!username) {
    return {
      raw,
      org: "",
      project: "",
      environment: "",
      username: shownName(raw),
    };
  }
  const [org = "", project = "", environment = ""] = parts;
  return { raw, org, project, environment, username: shownName(username) };
}

//------------------------------------------------------------------------------
/**
 * Turns a platform username into the name shown for it: only the last part of
 * `org_project_environment_username`, or the whole username when it is not in that form.
 */
export const formatUsername = (username: string): string =>
  parseClientName(username).username;

/** What to call the owner of a platform username on screen: `Guest` when there is none. */
export function displayNameOf(
  raw: string | null | undefined,
  fallback: string = GUEST_NAME,
): string {
  return (raw && formatUsername(raw)) || fallback;
}

/** The letters an avatar shows for the owner of a platform username. */
export function initialsOf(raw: string | null | undefined): string {
  return raw ? displayNameOf(raw).slice(0, 2) : GUEST_NAME.slice(0, 1);
}

//------------------------------------------------------------------------------
/**
 * `getClientName(clientId)`: what to call a client of the current session on screen, by
 * `formatUsername` — its username in the session, or `fallback` when the session does not know it
 * (yet), and `""` when there is neither. Same contract as the mobile viewer's spotlight.
 */
export function useClientName() {
  const { instance } = useContext(LivelinkContext);

  const getClientName = useCallback(
    (clientId: string, fallback = ""): string => {
      const username =
        instance?.session.getClient({ client_id: clientId })?.username ||
        fallback;
      return username ? formatUsername(username) : "";
    },
    [instance],
  );

  return { getClientName };
}
