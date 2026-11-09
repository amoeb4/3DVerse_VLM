/**
 * The Assistance mode's recoveries: for each kind of incident an operator can ask help with, the
 * steps back to production, in the client's loop Diagnostic ➔ Résolution ➔ Reprise. The incidents
 * are the client's: a worn cutting tool and a torch collision. "Other" is for anything else.
 *
 * Plain data, so the procedures can later come from a file the client edits, and Training can play
 * the same steps on the simulation.
 */

/** Who someone is in an assistance session. */
export type AssistRole = "operator" | "expert";

export const ROLE_LABELS: Record<AssistRole, string> = {
  operator: "Operator",
  expert: "Expert",
};

export const ROLE_DESCRIPTIONS: Record<AssistRole, string> = {
  operator: "At the machine",
  expert: "Remote, helping",
};

/** Font Awesome icon classes, without the `fas` prefix. */
export const ROLE_ICONS: Record<AssistRole, string> = {
  operator: "fa-helmet-safety",
  expert: "fa-headset",
};

export type Phase = "diagnose" | "fix" | "resume";

export const PHASE_LABELS: Record<Phase, string> = {
  diagnose: "Diagnose",
  fix: "Fix",
  resume: "Resume",
};

export type ProcedureStep = {
  id: string;
  phase: Phase;
  title: string;
  detail: string;
  /** Who does it. */
  actor: AssistRole;
  /**
   * Done with hands on the machine: only the operator can tick it, and it is never done from the
   * browser (moving the robot, NC Start).
   */
  atMachine: boolean;
  /** A safety reminder shown with the step. */
  caution?: string;
};

export type IncidentKind = "torch-collision" | "tool-wear" | "other";

export type IncidentKindInfo = {
  label: string;
  /** A Font Awesome icon class, without the `fas` prefix. */
  icon: string;
  /**
   * What the CN would say. Simulated: the CN's alarms are not connected yet, so this is the kind's
   * typical message, not one read from the machine.
   */
  alarm: string;
  steps: readonly ProcedureStep[];
};

const CLEAR_ROBOT: ProcedureStep = {
  id: "clear-robot",
  phase: "fix",
  title: "Clear the robot",
  detail:
    "Jog the torch away from the part, in reduced speed with the enabling switch held.",
  actor: "operator",
  atMachine: true,
  caution: "At the machine only: the robot is never moved from here.",
};

const RESUME: ProcedureStep = {
  id: "resume",
  phase: "resume",
  title: "Resume the program",
  detail:
    "Select the block to restart from, then press NC Start at the machine.",
  actor: "operator",
  atMachine: true,
  caution: "NC Start is pressed at the machine, never remotely.",
};

export const INCIDENT_KINDS: Record<IncidentKind, IncidentKindInfo> = {
  "torch-collision": {
    label: "Torch collision",
    icon: "fa-fire",
    alarm: "Collision detected on the torch: axes stopped",
    steps: [
      {
        id: "read-stop",
        phase: "diagnose",
        title: "Read the stop",
        detail:
          "The block, the trace and the cameras before the stop: where on the path did the torch hit, and what?",
        actor: "expert",
        atMachine: false,
      },
      {
        id: "inspect-torch",
        phase: "diagnose",
        title: "Inspect the torch",
        detail:
          "Swan neck bent? Nozzle or contact tube damaged? Change what is. Pin a note where it hit.",
        actor: "operator",
        atMachine: true,
      },
      CLEAR_ROBOT,
      {
        id: "find-error",
        phase: "fix",
        title: "Find the program error",
        detail:
          "Compare the path with the part at that block: approach, clearance, frame or tool.",
        actor: "expert",
        atMachine: false,
      },
      {
        id: "fix-program",
        phase: "fix",
        title: "Correct the program",
        detail:
          "Fix the path, then the operator loads the corrected program at the CN and checks it.",
        actor: "expert",
        atMachine: false,
      },
      {
        id: "auto-tcp",
        phase: "fix",
        title: "Run the automatic TCP",
        detail:
          "Measure the tool centre point again: the hit may have moved it. Report the deviation found.",
        actor: "operator",
        atMachine: true,
      },
      RESUME,
    ],
  },
  "tool-wear": {
    label: "Worn cutting tool",
    icon: "fa-screwdriver-wrench",
    alarm: "Tool wear limit reached: machining stopped",
    steps: [
      {
        id: "confirm-wear",
        phase: "diagnose",
        title: "Confirm the wear",
        detail:
          "The finish on the last pass, the sound and the cameras: worn, chipped or broken?",
        actor: "expert",
        atMachine: false,
      },
      CLEAR_ROBOT,
      {
        id: "change-tool",
        phase: "fix",
        title: "Change the tool",
        detail:
          "Same reference as in the program. Check the holder and the clamping.",
        actor: "operator",
        atMachine: true,
      },
      {
        id: "measure-length",
        phase: "fix",
        title: "Measure the tool length",
        detail:
          "On the tool setter, then enter it in the CN's tool offsets. Report the value.",
        actor: "operator",
        atMachine: true,
      },
      {
        id: "check-offset",
        phase: "fix",
        title: "Check the new offset",
        detail:
          "Compare it with the old tool's: a large gap means the wrong tool or a bad measure.",
        actor: "expert",
        atMachine: false,
      },
      RESUME,
    ],
  },
  other: {
    label: "Other problem",
    icon: "fa-circle-question",
    alarm: "Stopped by the operator",
    steps: [
      {
        id: "describe",
        phase: "diagnose",
        title: "Describe the problem",
        detail:
          "What was seen or heard, and when. Pin notes on the cell where it shows.",
        actor: "operator",
        atMachine: false,
      },
      {
        id: "diagnose",
        phase: "diagnose",
        title: "Find the cause",
        detail: "From the notes, the trace and the cameras, with the operator.",
        actor: "expert",
        atMachine: false,
      },
      {
        id: "fix",
        phase: "fix",
        title: "Fix it",
        detail: "As agreed with the expert. Note what was done.",
        actor: "operator",
        atMachine: true,
      },
      RESUME,
    ],
  },
};

export const INCIDENT_KIND_IDS = Object.keys(INCIDENT_KINDS) as IncidentKind[];

export const isIncidentKind = (value: unknown): value is IncidentKind =>
  typeof value === "string" && value in INCIDENT_KINDS;

export const isAssistRole = (value: unknown): value is AssistRole =>
  value === "operator" || value === "expert";

/** Whether someone in `role` may tick `step`: steps at the machine are the operator's. */
export const canTick = (step: ProcedureStep, role: AssistRole | null) =>
  role !== null && (!step.atMachine || role === "operator");
