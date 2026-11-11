import { useMemo } from "react";
import { useLabelPointsOfView } from "@3dverse/livelink-react";

import { labelCamera, type PointOfView } from "./labelCamera";

/** A point of interest looked up in the scene (`usePointOfInterest`). */
export type PointOfInterest = {
  /** The scene's labels are still being looked up: whether it has this one is not known yet. */
  isPending: boolean;
  pointOfView: PointOfView | null;
};

const normalized = (name: string | undefined) =>
  name?.trim().toLowerCase() ?? "";

/**
 * A point of interest of the scene, by name: the camera saved on the `label` (the editor's label
 * camera) whose title is `name`, or failing that whose entity is named so. In any case.
 *
 * `pointOfView` is `null` when the scene has no such label, when no camera was saved on it, and
 * while the scene's labels are still being looked up (`isPending`). It is the same object from
 * one render to the next for as long as the point of view itself does not change.
 */
export function usePointOfInterest(name: string): PointOfInterest {
  const { isPending, pointsOfView } = useLabelPointsOfView();

  const wanted = normalized(name);
  const found =
    pointsOfView.find(({ title }) => normalized(title) === wanted) ??
    pointsOfView.find(
      ({ entity }) => normalized(entity.debug_name?.value) === wanted,
    );
  const saved = found
    ? labelCamera([...found.position, ...found.orientation])
    : null;

  // By value: the labels are read into new arrays on every render.
  const key = saved ? JSON.stringify(saved) : "";
  const pointOfView = useMemo(
    () => (key ? (JSON.parse(key) as PointOfView) : null),
    [key],
  );
  return { isPending, pointOfView };
}
