import type { MachineStatus } from "../../config";

/** A machine's status as a chip: here on its tile, and in the viewer's `WelcomePanel`. */
export const MACHINE_STATUS: Record<
  MachineStatus,
  { label: string; className: string }
> = {
  operational: {
    label: "Operational",
    className: "bg-positive/15 text-positive border-positive/30",
  },
  "in-progress": {
    label: "In progress",
    className: "bg-warning/15 text-warning-800 border-warning/40",
  },
  deprecated: {
    label: "Deprecated",
    className: "bg-secondary/10 text-secondary border-tertiary",
  },
};
