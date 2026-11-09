import { useContext } from "react";
import { useEntity } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

import { PartEntitiesContext } from "../partEntitiesContext";
import { TORCH_EUID } from "../components/weld/torch";
import type { Checkpoint } from "./checkpoints";

/**
 * The entity each checkpoint sits on: an axis by its `part_N` name, or the torch tip by its id;
 * `null` for one the scene does not have. For the markers over the robot and the run's camera.
 */
export function useCheckpointEntity() {
  const { entitiesMap } = useContext(PartEntitiesContext);
  // The one point not on an axis (`checkpoints.ts`).
  const torch = useEntity({ euid: TORCH_EUID }).entity;

  return (checkpoint: Checkpoint): Entity | null =>
    "name" in checkpoint.anchor
      ? (entitiesMap.get(checkpoint.anchor.name) ?? null)
      : checkpoint.anchor.euid === TORCH_EUID
        ? torch
        : null;
}
