import { useSyncExternalStore } from "react";

import { INCIDENT_KINDS, type IncidentKind } from "./procedures";

/**
 * A machine's last incident, as this browser last saw it in the viewer: for the startup page's
 * tiles, which do not join the machines' sessions where the incidents live. Kept on this device,
 * by scene. It may be out of date — someone else may have closed it since — so the tiles only
 * call one open while the machine's session is still running.
 */
export type IncidentDigest = {
  kind: IncidentKind;
  openedAt: number;
  /** `null` while it was open. */
  closedAt: number | null;
  outcome: "resumed" | "closed" | null;
  /** When the viewer last saw it so. */
  seenAt: number;
};

const STORAGE_KEY = "vlm.incidents";

type Digests = Readonly<Record<string, IncidentDigest>>;

let digests: Digests = readDigests();
const listeners = new Set<() => void>();

/** Records what the viewer sees of a machine's last incident. */
export function recordIncidentDigest(sceneId: string, digest: IncidentDigest) {
  digests = { ...digests, [sceneId]: digest };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(digests));
  } catch {
    // Private mode or blocked storage: the tiles just won't know.
  }
  notify();
}

/** Every machine's last incident seen on this device, by scene. */
export function useIncidentDigests(): Digests {
  return useSyncExternalStore(subscribe, () => digests);
}

/** A machine's last incident seen on this device, or `null`. */
export function useIncidentDigest(sceneId: string): IncidentDigest | null {
  return useSyncExternalStore(subscribe, () => digests[sceneId] ?? null);
}

//------------------------------------------------------------------------------
function notify() {
  for (const listener of listeners) listener();
}

/** Also follows the other tabs: a viewer open in one updates the gallery in another. */
function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  digests = readDigests();
  notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** What is stored, keeping only well-formed entries: it comes from an older version, or by hand. */
function readDigests(): Digests {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}",
    );
    if (!stored || typeof stored !== "object") return {};
    const valid: Record<string, IncidentDigest> = {};
    for (const [sceneId, value] of Object.entries(stored)) {
      const digest = value as Partial<IncidentDigest> | null;
      if (
        digest &&
        typeof digest.kind === "string" &&
        digest.kind in INCIDENT_KINDS &&
        typeof digest.openedAt === "number" &&
        typeof digest.seenAt === "number" &&
        (digest.closedAt === null || typeof digest.closedAt === "number")
      ) {
        valid[sceneId] = {
          kind: digest.kind,
          openedAt: digest.openedAt,
          closedAt: digest.closedAt,
          outcome:
            digest.outcome === "resumed" || digest.outcome === "closed"
              ? digest.outcome
              : null,
          seenAt: digest.seenAt,
        };
      }
    }
    return valid;
  } catch {
    return {};
  }
}
