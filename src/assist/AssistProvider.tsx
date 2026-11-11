import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  LivelinkContext,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Entity, Vec3 } from "@3dverse/livelink";

/** What a click on the 3D view hit: the entity, and the point on it in world space. */
export type PickedPoint = { entity: Entity; ws_position: Vec3 };

/**
 * Takes a click on the 3D view before the selection does (`useEntityPicking`): what it hit, or
 * `null` for a click that hit nothing. True once it has dealt with the click.
 */
export type PickInterceptor = (picked: PickedPoint | null) => boolean;

import { logEvent } from "../live/eventLog";
import { holdSimulation, simulateOnSiteStart } from "../live/processFeed";
import { displayNameOf } from "../utils/clientName";
import {
  AssistContext,
  authorLabel,
  type AssistContextValue,
} from "./assistContext";
import {
  AssistStore,
  openIncident,
  type AssistChange,
  type AssistSnapshot,
} from "./assistStore";
import { INCIDENT_KINDS } from "./procedures";
import { useAssistRole } from "./useAssistRole";
import { EXPERT_NAME } from "./participantLook";
import { useFollow } from "./useFollow";
import { hasKeyboard } from "../utils/hasKeyboard";
import { useMiniToastStore } from "../xr/stores";

/**
 * Said (`MiniToast`) as a note waits for its place. Where there is a keyboard, with the key that
 * cancels; on a touch screen, the button that started it cancels (`AssistActions`).
 */
const PIN_HINT = "Click anywhere";
const PIN_HINT_WITH_CANCEL = "Click anywhere. Cancel";
const PIN_CANCEL_KEY = "Esc";
/** Said when the click that places a note hits nothing. */
const NO_PIN_TARGET_MESSAGE = "Nothing there: click on a part of the cell";
const PIN_MESSAGES = [PIN_HINT, PIN_HINT_WITH_CANCEL, NO_PIN_TARGET_MESSAGE];

const EMPTY_SNAPSHOT: AssistSnapshot = {
  ready: false,
  presences: [],
  incidents: [],
  steps: [],
  pins: [],
  checks: [],
};
const noSubscription = () => () => {};
const emptySnapshot = () => EMPTY_SNAPSHOT;

/**
 * The assistance session (`assistStore.ts`), for every mode: an incident opened shows in all of
 * them. `active` (the Assistance mode) is when this viewer is part of it: its presence, with its
 * role, is published, and it can follow someone's camera.
 *
 * `pickInterceptor` is set to a function the viewport's picking calls first: it takes the click
 * while a note is being placed, and the entity clicked stays selected while the note is written. A
 * click that hits no entity places nothing: a line says so, and the note is still to be placed.
 */
export function AssistProvider({
  active,
  cameraController,
  pickInterceptor,
  children,
}: {
  active: boolean;
  cameraController: DefaultCameraController | null;
  pickInterceptor: React.RefObject<PickInterceptor | null>;
  children: React.ReactNode;
}) {
  const { instance } = useContext(LivelinkContext);
  const scene = instance?.scene ?? null;
  const [store, setStore] = useState<AssistStore | null>(null);

  // What changes in the session goes to the event log; the simulated CN stops with an incident
  // and restarts when the program is resumed, as the machine would.
  useEffect(() => {
    if (!scene) return;
    const created: AssistStore = new AssistStore(
      scene,
      (change: AssistChange) => onSessionChange(change, created),
    );
    setStore(created);
    void created.start();
    return () => {
      created.dispose();
      setStore(null);
    };
  }, [scene]);

  const snapshot = useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    store?.getSnapshot ?? emptySnapshot,
  );
  const incident = openIncident(snapshot);

  const { role, setRole } = useAssistRole();
  const client = instance?.session.current_client ?? null;
  const me = useMemo(
    () =>
      client
        ? {
            clientId: client.id,
            // An expert is VLM's support, whoever they are (`participantLook`).
            name:
              active && role === "expert"
                ? EXPERT_NAME
                : displayNameOf(client.username),
            role: active ? role : null,
          }
        : null,
    [client, role, active],
  );

  // This viewer's presence, while in Assistance with a role.
  const [pointing, setPointing] = useState<string | null>(null);
  useEffect(() => {
    if (!store) return;
    if (active && role && me) {
      store.setPresence({
        clientId: me.clientId,
        name: me.name,
        role,
        pointing,
      });
    } else {
      store.setPresence(null);
    }
  }, [store, active, role, me, pointing]);

  // A step pointed to belongs to an incident: none any more once it is closed.
  const incidentId = incident?.id ?? null;
  useEffect(() => {
    setPointing(null);
  }, [incidentId]);

  // Notes.
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pinDraft, setPinDraft] = useState<Vec3 | null>(null);
  // The entity the note is being pinned on, selected while the note is written.
  const [pinTarget, setPinTarget] = useState<Entity | null>(null);
  const startPin = useCallback(() => {
    setPinDraft(null);
    setPinTarget(null);
    setIsPlacingPin(true);
  }, []);
  const cancelPin = useCallback(() => {
    setIsPlacingPin(false);
    setPinDraft(null);
    setPinTarget(null);
  }, []);
  useEffect(() => {
    pickInterceptor.current = (picked) => {
      if (!isPlacingPin) return false;
      // A click on the background: a note is pinned on an entity. Still placing, to try again.
      if (!picked) {
        useMiniToastStore.getState().showMiniToast(NO_PIN_TARGET_MESSAGE);
        return true;
      }
      setPinDraft(picked.ws_position);
      setPinTarget(picked.entity);
      setIsPlacingPin(false);
      return true;
    };
    return () => {
      pickInterceptor.current = null;
    };
  }, [pickInterceptor, isPlacingPin]);
  useEffect(() => {
    if (!scene || !pinTarget) return;
    void scene.highlightEntities({ entities: [pinTarget] });
    return () => {
      void scene.highlightEntities({ entities: [] });
    };
  }, [scene, pinTarget]);
  // While a note waits for its place, the pointer is a pin (`.is-placing-pin`, index.css), and a
  // line says what to do. Placed or cancelled, the line no longer holds: it goes, if it is still
  // one of the note's own.
  useEffect(() => {
    if (!isPlacingPin) return;
    document.body.classList.add("is-placing-pin");
    const { showMiniToast } = useMiniToastStore.getState();
    if (hasKeyboard()) {
      showMiniToast(PIN_HINT_WITH_CANCEL, PIN_CANCEL_KEY);
    } else {
      showMiniToast(PIN_HINT);
    }
    return () => {
      document.body.classList.remove("is-placing-pin");
      const { message, hideMiniToast } = useMiniToastStore.getState();
      if (message !== null && PIN_MESSAGES.includes(message)) {
        hideMiniToast();
      }
    };
  }, [isPlacingPin]);
  useEffect(() => {
    if (!isPlacingPin && !pinDraft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelPin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlacingPin, pinDraft, cancelPin]);

  // Following someone's camera, only in Assistance.
  const [following, setFollowing] = useState<string | null>(null);
  const stopFollowing = useCallback(() => setFollowing(null), []);
  useFollow(cameraController, active ? following : null, stopFollowing);

  // Leaving the mode drops what was going on in it.
  useEffect(() => {
    if (!active) {
      setFollowing(null);
      cancelPin();
    }
  }, [active, cancelPin]);

  const value = useMemo<AssistContextValue>(
    () => ({
      store,
      snapshot,
      incident,
      me,
      role,
      setRole,
      pointing,
      pointTo: setPointing,
      isPlacingPin,
      pinDraft,
      startPin,
      cancelPin,
      following,
      setFollowing,
    }),
    [
      store,
      snapshot,
      incident,
      me,
      role,
      setRole,
      pointing,
      isPlacingPin,
      pinDraft,
      startPin,
      cancelPin,
      following,
    ],
  );

  return (
    <AssistContext.Provider value={value}>{children}</AssistContext.Provider>
  );
}

//------------------------------------------------------------------------------
function onSessionChange(change: AssistChange, store: AssistStore) {
  switch (change.type) {
    case "incident-opened": {
      const { incident, initial } = change;
      if (!incident.closed) holdSimulation();
      if (!initial) {
        logEvent(
          "warn",
          "assist",
          `${authorLabel(incident.by)} asked for help: ${INCIDENT_KINDS[incident.kind].label}`,
        );
      }
      return;
    }
    case "incident-closed": {
      const { incident, initial } = change;
      if (initial || !incident.closed) return;
      const { by, outcome } = incident.closed;
      const label = INCIDENT_KINDS[incident.kind].label;
      if (outcome === "resumed") {
        simulateOnSiteStart();
        logEvent(
          "ok",
          "assist",
          `${authorLabel(by)} resumed the program: ${label} closed`,
        );
      } else {
        logEvent(
          "info",
          "assist",
          `${authorLabel(by)} closed the incident: ${label}`,
        );
      }
      return;
    }
    case "step-done": {
      const { step, initial } = change;
      if (initial) return;
      const incident = store
        .getSnapshot()
        .incidents.find(({ id }) => id === step.incidentId);
      const title =
        incident &&
        INCIDENT_KINDS[incident.kind].steps.find(({ id }) => id === step.stepId)
          ?.title;
      logEvent(
        "ok",
        "assist",
        `${authorLabel(step.by)}: ${title ?? step.stepId}, done`,
      );
      return;
    }
    case "pin-added": {
      const { pin, initial } = change;
      if (!initial) {
        logEvent(
          "info",
          "assist",
          `${authorLabel(pin.by)} pinned a note: “${pin.text}”`,
        );
      }
      return;
    }
  }
}
