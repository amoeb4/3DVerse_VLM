import { useEffect, useMemo } from "react";
import { useEntities } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

import { HoloStage } from "./HoloStage";
import { useSharedOverlay } from "./sharedOverlay";
import { holoShapeOf, type HoloShape } from "./holoTags";

const byNaturalName = (a: { entity: Entity }, b: { entity: Entity }) =>
  (a.entity.name ?? "").localeCompare(b.entity.name ?? "", undefined, {
    numeric: true,
  });

/**
 * A holographic HUD around every entity tagged `hud` (or `hud:cylinder:<axis>`, see `holoTags`):
 * glowing shells — boxes first, then the parts' real meshes from the 3dverse API — and joint
 * gauges. Drawn with Three.js in the viewport's shared overlay (`sharedOverlay.ts`), which Livelink
 * composites onto each streamed frame, so it stays locked to the picture.
 *
 * The server renders the machine, so the browser has no depth for it: each part's shell is drawn
 * into the depth buffer, invisibly, and hides whatever of the HUD is behind it.
 *
 * Must be rendered inside a `SharedOverlayProvider`.
 */
export function HoloHud() {
  const overlay = useSharedOverlay();
  const { entities } = useEntities({ mandatory_components: ["tags"] });

  const tagged = entities
    .map((entity) => ({ entity, shape: holoShapeOf(entity) }))
    .filter((part): part is { entity: Entity; shape: HoloShape } =>
      Boolean(part.shape),
    )
    .sort(byNaturalName);
  // Rebuilt only when the parts or their shapes change, not whenever the hook hands back a new array.
  const taggedKey = tagged
    .map(({ entity, shape }) => `${entity.id}:${JSON.stringify(shape)}`)
    .join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parts = useMemo(() => tagged, [taggedKey]);

  useEffect(() => {
    if (!overlay || parts.length === 0) {
      return;
    }

    let disposed = false;
    let frame = 0;
    let stage: HoloStage | null = null;
    let stopListening: (() => void) | null = null;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();

    HoloStage.create(parts)
      .then((created) => {
        if (disposed) {
          created.dispose();
          return;
        }
        stage = created;
        overlay.scene.add(stage.root);
        stopListening = overlay.addDrawListener(() => {
          const elapsed = (performance.now() - start) / 1000;
          stage?.update({
            time: reducedMotion ? 0 : elapsed,
            introTime: reducedMotion ? Infinity : elapsed,
            viewportWidth: overlay.width,
            viewportHeight: overlay.height,
          });
        });

        // The boxes are up at once; the parts' real meshes follow from the API and scan in over
        // them. Each hologram ignores its mesh if the HUD is gone by the time it arrives.
        void created.loadGeometry().then(() => {
          if (!disposed && reducedMotion) {
            overlay.requestRedraw();
          }
        });

        // The server only sends a frame when the scene changes; redraw the last one so the HUD
        // keeps moving while the machine is still. Under reduced motion it is static.
        const tick = () => {
          if (disposed) {
            return;
          }
          overlay.requestRedraw();
          frame = requestAnimationFrame(tick);
        };
        if (!reducedMotion) {
          frame = requestAnimationFrame(tick);
        } else {
          overlay.requestRedraw();
        }
      })
      .catch((error) => console.error("HoloHud: cannot build the HUD", error));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      stopListening?.();
      stage?.dispose();
      // The frame, without the HUD.
      overlay.requestRedraw();
    };
  }, [overlay, parts]);

  return null;
}
