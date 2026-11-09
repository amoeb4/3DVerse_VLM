import type { Entity, Scene, Vec3 } from "@3dverse/livelink";

import {
  isAssistRole,
  isIncidentKind,
  type AssistRole,
  type IncidentKind,
} from "./procedures";

/**
 * What the people in an assistance session share: who is there and in which role, the incident,
 * the recovery's steps done, and the notes pinned on the cell. Kept in the 3dverse session itself,
 * as entities of the scene (`tags`: this app's tag, the record's kind, its data as JSON), so it
 * needs nothing beyond the session: whoever joins with the URL sees it, and it lasts as long as
 * the session.
 *
 * One entity per record, each written by one person: a step done is an entity created (undone:
 * deleted), never a field two people could overwrite at once. Someone's presence is deleted with
 * their connection; the rest stays for the whole session.
 *
 * The presence entity's transform is free: where a pointer in the cell (the participants' cursors)
 * can go later.
 */

export const ASSIST_TAG = "vlm-assist";

/** Who did something, as it was when they did it: they may have left since. */
export type Author = {
  clientId: string;
  name: string;
  role: AssistRole | null;
};

export type Presence = {
  entityId: string;
  clientId: string;
  name: string;
  role: AssistRole;
  /** The recovery step they point the others to. */
  pointing: string | null;
};

export type Closure = {
  at: number;
  by: Author;
  /** `resumed`: the program restarted at the machine. `closed`: closed without (false alarm...). */
  outcome: "resumed" | "closed";
};

export type Incident = {
  entityId: string;
  id: string;
  kind: IncidentKind;
  note: string;
  openedAt: number;
  by: Author;
  /** The CN when it was opened (simulated until the CN is connected). */
  program: string;
  block: number;
  /** Seeds the simulated trace, for everyone to see the same one. */
  seed: number;
  closed: Closure | null;
};

export type StepRecord = {
  entityId: string;
  incidentId: string;
  stepId: string;
  at: number;
  by: Author;
};

export type Pin = {
  entityId: string;
  /** The incident it was pinned during; `null` outside one. */
  incidentId: string | null;
  position: Vec3;
  text: string;
  at: number;
  by: Author;
};

/** What the operator found at a point: fine, or not looked at (skipped). */
export type CheckResult = "ok" | "skipped";

/** A point of the robot checked by the operator (`checkpoints.ts`). Unchecked: deleted. */
export type CheckRecord = {
  entityId: string;
  /** The incident it was checked during; `null` outside one (the Diagnostic). */
  incidentId: string | null;
  checkId: string;
  /** Records from before results existed are `ok`. */
  result: CheckResult;
  at: number;
  by: Author;
};

export type AssistSnapshot = {
  /** The session's records have been read once. */
  ready: boolean;
  /** One per client, in the order they arrived. */
  presences: readonly Presence[];
  /** Oldest first. */
  incidents: readonly Incident[];
  steps: readonly StepRecord[];
  /** Oldest first. */
  pins: readonly Pin[];
  checks: readonly CheckRecord[];
};

/** Something that changed in the session; `initial`: it was already there when this viewer came. */
export type AssistChange =
  | { type: "incident-opened"; incident: Incident; initial: boolean }
  | { type: "incident-closed"; incident: Incident; initial: boolean }
  | { type: "step-done"; step: StepRecord; initial: boolean }
  | { type: "pin-added"; pin: Pin; initial: boolean };

/** The incident being worked on: the last one opened and not closed. */
export function openIncident(snapshot: AssistSnapshot): Incident | null {
  for (let i = snapshot.incidents.length - 1; i >= 0; i -= 1) {
    if (!snapshot.incidents[i].closed) return snapshot.incidents[i];
  }
  return null;
}

/** The last incident closed, for its summary. */
export function lastClosedIncident(snapshot: AssistSnapshot): Incident | null {
  let last: Incident | null = null;
  for (const incident of snapshot.incidents) {
    if (incident.closed && (!last || incident.closed.at > last.closed!.at)) {
      last = incident;
    }
  }
  return last;
}

/** The steps done in an incident, by step: the first time each was ticked. */
export function stepsDone(
  snapshot: AssistSnapshot,
  incidentId: string,
): Map<string, StepRecord> {
  const done = new Map<string, StepRecord>();
  for (const step of snapshot.steps) {
    if (step.incidentId !== incidentId) continue;
    const seen = done.get(step.stepId);
    if (!seen || step.at < seen.at) done.set(step.stepId, step);
  }
  return done;
}

//------------------------------------------------------------------------------
type Kind = "presence" | "incident" | "step" | "pin" | "check";
type Record_ = Presence | Incident | StepRecord | Pin | CheckRecord;

type Tracked = {
  entity: Entity;
  kind: Kind;
  record: Record_;
  stopListening: () => void;
};

const EMPTY: AssistSnapshot = {
  ready: false,
  presences: [],
  incidents: [],
  steps: [],
  pins: [],
  checks: [],
};

/** No `crypto.randomUUID` on plain http, as on a phone joining over the LAN. */
const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function asAuthor(value: unknown): Author | null {
  if (!value || typeof value !== "object") return null;
  const { clientId, name, role } = value as Record<string, unknown>;
  if (!isString(clientId) || !isString(name)) return null;
  return { clientId, name, role: isAssistRole(role) ? role : null };
}

function asClosure(value: unknown): Closure | null {
  if (!value || typeof value !== "object") return null;
  const { at, by, outcome } = value as Record<string, unknown>;
  const author = asAuthor(by);
  if (!isNumber(at) || !author) return null;
  return {
    at,
    by: author,
    outcome: outcome === "resumed" ? "resumed" : "closed",
  };
}

/** The record an entity holds, if it is one of ours and well formed. */
function parse(entity: Entity): { kind: Kind; record: Record_ } | null {
  const tags = entity.tags?.value;
  if (!Array.isArray(tags) || tags[0] !== ASSIST_TAG || !isString(tags[2])) {
    return null;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(tags[2]);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const entityId = entity.id;
  const by = asAuthor(data.by);

  switch (tags[1]) {
    case "presence": {
      const { clientId, name, role, pointing } = data;
      if (!isString(clientId) || !isString(name) || !isAssistRole(role)) {
        return null;
      }
      return {
        kind: "presence",
        record: {
          entityId,
          clientId,
          name,
          role,
          pointing: isString(pointing) ? pointing : null,
        },
      };
    }
    case "incident": {
      const { id, kind, note, openedAt, program, block, seed } = data;
      if (
        !isString(id) ||
        !isIncidentKind(kind) ||
        !isNumber(openedAt) ||
        !by
      ) {
        return null;
      }
      return {
        kind: "incident",
        record: {
          entityId,
          id,
          kind,
          note: isString(note) ? note : "",
          openedAt,
          by,
          program: isString(program) ? program : "",
          block: isNumber(block) ? block : 0,
          seed: isNumber(seed) ? seed : 1,
          closed: asClosure(data.closed),
        },
      };
    }
    case "step": {
      const { incidentId, stepId, at } = data;
      if (!isString(incidentId) || !isString(stepId) || !isNumber(at) || !by) {
        return null;
      }
      return { kind: "step", record: { entityId, incidentId, stepId, at, by } };
    }
    case "pin": {
      const { incidentId, text, at } = data;
      const position = entity.local_transform?.position;
      if (!isString(text) || !isNumber(at) || !by || !position) return null;
      return {
        kind: "pin",
        record: {
          entityId,
          incidentId: isString(incidentId) ? incidentId : null,
          position: [position[0], position[1], position[2]],
          text,
          at,
          by,
        },
      };
    }
    case "check": {
      const { incidentId, checkId, result, at } = data;
      if (!isString(checkId) || !isNumber(at) || !by) return null;
      return {
        kind: "check",
        record: {
          entityId,
          incidentId: isString(incidentId) ? incidentId : null,
          checkId,
          result: result === "skipped" ? "skipped" : "ok",
          at,
          by,
        },
      };
    }
    default:
      return null;
  }
}

/** The data part of a record, as stored: without the entity's own fields. */
type Data<T> = Omit<T, "entityId" | "position">;

//------------------------------------------------------------------------------
/**
 * The shared state of one session, as a store for `useSyncExternalStore`: `start()` reads what is
 * there and follows the changes; the actions write to the session.
 */
export class AssistStore {
  readonly #scene: Scene;
  readonly #onChange: (change: AssistChange) => void;
  readonly #tracked = new Map<string, Tracked>();
  /** Ours by name, created by someone else, waiting for their tags to arrive. */
  readonly #pending = new Map<string, () => void>();
  readonly #listeners = new Set<() => void>();
  #snapshot: AssistSnapshot = EMPTY;
  #ready = false;
  #disposed = false;

  // This viewer's presence: what it should be, what was written, and the entity.
  #presenceWanted: Data<Presence> | null = null;
  #presenceWritten = "";
  #presenceEntity: Entity | null = null;
  #presenceBusy = false;

  constructor(
    scene: Scene,
    onChange: (change: AssistChange) => void = () => {},
  ) {
    this.#scene = scene;
    this.#onChange = onChange;
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = () => this.#snapshot;

  /** Reads the session's records, then follows them. */
  async start() {
    this.#scene.addEventListener("on-entities-created", this.#onCreated);
    this.#scene.addEventListener("on-entities-deleted", this.#onDeleted);
    try {
      const found = await this.#scene.findEntitiesWithComponents({
        mandatory_components: ["tags"],
        forbidden_components: [],
      });
      if (this.#disposed) return;
      for (const entity of found) this.#track(entity, true);
    } catch (error) {
      console.warn("Assistance: cannot read the session's records", error);
    }
    this.#ready = true;
    this.#rebuild();
  }

  dispose() {
    this.#disposed = true;
    this.#scene.removeEventListener("on-entities-created", this.#onCreated);
    this.#scene.removeEventListener("on-entities-deleted", this.#onDeleted);
    for (const tracked of this.#tracked.values()) tracked.stopListening();
    for (const stop of this.#pending.values()) stop();
    this.#tracked.clear();
    this.#pending.clear();
    const presence = this.#presenceEntity;
    this.#presenceEntity = null;
    if (presence) {
      void this.#scene.deleteEntities({ entities: [presence] }).catch(() => {});
    }
  }

  //----------------------------------------------------------------------------
  /** This viewer's presence: its role, and the step it points to; `null` to leave. */
  setPresence(presence: Data<Presence> | null) {
    this.#presenceWanted = presence;
    void this.#syncPresence();
  }

  async openIncident(incident: Omit<Data<Incident>, "id" | "closed" | "seed">) {
    await this.#create("incident", {
      ...incident,
      id: newId(),
      seed: Math.floor(Math.random() * 2 ** 31),
      closed: null,
    } satisfies Data<Incident>);
  }

  closeIncident(incident: Incident, closure: Closure) {
    const tracked = this.#tracked.get(incident.entityId);
    if (!tracked || incident.closed) return;
    const data: Data<Incident> = {
      id: incident.id,
      kind: incident.kind,
      note: incident.note,
      openedAt: incident.openedAt,
      by: incident.by,
      program: incident.program,
      block: incident.block,
      seed: incident.seed,
      closed: closure,
    };
    this.#write(tracked.entity, "incident", data);
  }

  /** Ticks a step (`by`), or unticks it (`null`): every record of it goes. */
  async setStepDone(incident: Incident, stepId: string, by: Author | null) {
    const existing = [...this.#tracked.values()].filter(
      ({ kind, record }) =>
        kind === "step" &&
        (record as StepRecord).incidentId === incident.id &&
        (record as StepRecord).stepId === stepId,
    );
    if (by === null) {
      await this.#remove(existing.map(({ entity }) => entity));
    } else if (existing.length === 0) {
      await this.#create("step", {
        incidentId: incident.id,
        stepId,
        at: Date.now(),
        by,
      } satisfies Data<StepRecord>);
    }
  }

  /**
   * Checks a point of the robot (`by`), with what was found (`result`), or unchecks it (`null`):
   * every record of it goes. A point checked again with another result is rewritten.
   */
  async setChecked(
    incidentId: string | null,
    checkId: string,
    by: Author | null,
    result: CheckResult = "ok",
  ) {
    const existing = [...this.#tracked.values()].filter(
      ({ kind, record }) =>
        kind === "check" &&
        (record as CheckRecord).incidentId === incidentId &&
        (record as CheckRecord).checkId === checkId,
    );
    if (by === null) {
      await this.#remove(existing.map(({ entity }) => entity));
      return;
    }
    if (
      existing.length === 1 &&
      (existing[0].record as CheckRecord).result === result
    ) {
      return;
    }
    await this.#remove(existing.map(({ entity }) => entity));
    await this.#create("check", {
      incidentId,
      checkId,
      result,
      at: Date.now(),
      by,
    } satisfies Data<CheckRecord>);
  }

  async addPin(position: Vec3, pin: Data<Pin>) {
    await this.#create("pin", pin, { position });
  }

  async removePin(pin: Pin) {
    const tracked = this.#tracked.get(pin.entityId);
    if (tracked) await this.#remove([tracked.entity]);
  }

  //----------------------------------------------------------------------------
  #onCreated = (event: { readonly entities: readonly Entity[] }) => {
    for (const entity of event.entities) this.#track(entity, false);
  };

  #onDeleted = (event: { includes(entity: Entity): boolean }) => {
    let changed = false;
    for (const [id, tracked] of this.#tracked) {
      if (event.includes(tracked.entity)) {
        tracked.stopListening();
        this.#tracked.delete(id);
        changed = true;
      }
    }
    if (changed) this.#rebuild();
  };

  #track(entity: Entity, initial: boolean) {
    if (this.#disposed || this.#tracked.has(entity.id)) return;
    const parsed = parse(entity);
    if (!parsed) {
      // Created by someone else with our name: its tags may come with its first update.
      if (
        entity.name?.startsWith(ASSIST_TAG) &&
        !this.#pending.has(entity.id)
      ) {
        const onUpdate = () => {
          if (!parse(entity)) return;
          stop();
          this.#pending.delete(entity.id);
          this.#track(entity, initial);
        };
        const stop = () =>
          entity.removeEventListener("on-entity-updated", onUpdate);
        entity.addEventListener("on-entity-updated", onUpdate);
        this.#pending.set(entity.id, stop);
      }
      return;
    }
    const onUpdate = () => this.#refresh(entity.id);
    entity.addEventListener("on-entity-updated", onUpdate);
    this.#tracked.set(entity.id, {
      entity,
      ...parsed,
      stopListening: () =>
        entity.removeEventListener("on-entity-updated", onUpdate),
    });
    this.#announce(parsed.kind, null, parsed.record, initial);
    this.#rebuild();
  }

  #refresh(id: string) {
    const tracked = this.#tracked.get(id);
    if (!tracked) return;
    const parsed = parse(tracked.entity);
    if (!parsed || parsed.kind !== tracked.kind) return;
    const previous = tracked.record;
    tracked.record = parsed.record;
    this.#announce(parsed.kind, previous, parsed.record, false);
    this.#rebuild();
  }

  #announce(
    kind: Kind,
    previous: Record_ | null,
    record: Record_,
    initial: boolean,
  ) {
    if (kind === "incident") {
      const incident = record as Incident;
      if (!previous)
        this.#onChange({ type: "incident-opened", incident, initial });
      if (incident.closed && !(previous as Incident | null)?.closed) {
        this.#onChange({ type: "incident-closed", incident, initial });
      }
    } else if (kind === "step" && !previous) {
      this.#onChange({
        type: "step-done",
        step: record as StepRecord,
        initial,
      });
    } else if (kind === "pin" && !previous) {
      this.#onChange({ type: "pin-added", pin: record as Pin, initial });
    }
  }

  #rebuild() {
    const presences = new Map<string, Presence>();
    const incidents: Incident[] = [];
    const steps: StepRecord[] = [];
    const pins: Pin[] = [];
    const checks: CheckRecord[] = [];
    for (const { kind, record } of this.#tracked.values()) {
      if (kind === "presence") {
        const presence = record as Presence;
        presences.set(presence.clientId, presence);
      } else if (kind === "incident") incidents.push(record as Incident);
      else if (kind === "step") steps.push(record as StepRecord);
      else if (kind === "check") checks.push(record as CheckRecord);
      else pins.push(record as Pin);
    }
    incidents.sort((a, b) => a.openedAt - b.openedAt);
    pins.sort((a, b) => a.at - b.at);
    this.#snapshot = {
      ready: this.#ready,
      presences: [...presences.values()],
      incidents,
      steps,
      pins,
      checks,
    };
    for (const listener of this.#listeners) listener();
  }

  //----------------------------------------------------------------------------
  async #create(
    kind: Kind,
    data: object,
    { position = [0, 0, 0] as Vec3, deleteOnDisconnect = false } = {},
  ) {
    const entity = await this.#scene.newEntity({
      name: `${ASSIST_TAG}/${kind}`,
      components: {
        local_transform: { position },
        tags: { value: [ASSIST_TAG, kind, JSON.stringify(data)] },
      },
      options: { delete_on_client_disconnection: deleteOnDisconnect },
    });
    if (this.#disposed) {
      if (deleteOnDisconnect) {
        void this.#scene.deleteEntities({ entities: [entity] }).catch(() => {});
      }
      return entity;
    }
    this.#track(entity, false);
    return entity;
  }

  #write(entity: Entity, kind: Kind, data: object) {
    entity.updateComponent("tags", {
      value: [ASSIST_TAG, kind, JSON.stringify(data)],
    });
    this.#refresh(entity.id);
  }

  async #remove(entities: Entity[]) {
    if (entities.length === 0) return;
    for (const entity of entities) {
      this.#tracked.get(entity.id)?.stopListening();
      this.#tracked.delete(entity.id);
    }
    this.#rebuild();
    await this.#scene.deleteEntities({ entities });
  }

  /** Brings this viewer's presence entity to what is wanted, one write at a time. */
  async #syncPresence() {
    if (this.#presenceBusy) return;
    this.#presenceBusy = true;
    try {
      while (!this.#disposed) {
        const wanted = this.#presenceWanted;
        const entity = this.#presenceEntity;
        if (!wanted) {
          if (!entity) break;
          this.#presenceEntity = null;
          this.#presenceWritten = "";
          await this.#remove([entity]);
          continue;
        }
        const text = JSON.stringify(wanted);
        if (!entity) {
          this.#presenceEntity = await this.#create("presence", wanted, {
            deleteOnDisconnect: true,
          });
          this.#presenceWritten = text;
          continue;
        }
        if (this.#presenceWritten !== text) {
          this.#write(entity, "presence", wanted);
          this.#presenceWritten = text;
          continue;
        }
        break;
      }
    } catch (error) {
      console.warn("Assistance: cannot update the presence", error);
    } finally {
      this.#presenceBusy = false;
    }
  }
}
