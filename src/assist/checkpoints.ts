import { TORCH_EUID } from "../components/weld/torch";

/**
 * The points of the robot the operator checks at the machine, in Assistance: shown over the robot,
 * each where it is, and checked one by one by the operator — shared through the session, so the
 * expert sees them done. What a torch collision calls for, the client's main incident, from the
 * base to the torch tip.
 *
 * Each sits on an entity of the cell: an axis by its entity name (`part_N`), or the torch tip by
 * its id. A point whose entity the scene does not have is not shown. Plain data, so the list can
 * later come from the procedures the client edits.
 */
export type Checkpoint = {
  id: string;
  /** Short, on the marker. */
  label: string;
  /** What to check, on the marker's card. */
  detail: string;
  anchor: { name: string } | { euid: string };
};

export const CHECKPOINTS: readonly Checkpoint[] = [
  {
    id: "base",
    label: "Base · A1",
    detail: "No impact marks, cables and hoses not pinched",
    anchor: { name: "part_1" },
  },
  {
    id: "shoulder",
    label: "Shoulder · A2",
    detail: "No play, no abnormal noise when jogged",
    anchor: { name: "part_2" },
  },
  {
    id: "elbow",
    label: "Elbow · A3",
    detail: "Hose package secured, no rubbing",
    anchor: { name: "part_3" },
  },
  {
    id: "wrist",
    label: "Wrist · A5",
    detail: "No impact marks, no play",
    anchor: { name: "part_5" },
  },
  {
    id: "torch-mount",
    label: "Torch mount · A6",
    detail: "Breakaway sensor reset, mount tight and aligned",
    anchor: { name: "part_6" },
  },
  {
    id: "torch-tip",
    label: "Torch tip",
    detail: "Neck straight, nozzle and contact tip clean, wire stick-out right",
    anchor: { euid: TORCH_EUID },
  },
];
