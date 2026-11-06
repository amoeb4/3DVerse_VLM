import { useContext, useEffect, useMemo } from "react";
import { ViewportContext, useEntities } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

import { HoloOverlay } from "./HoloOverlay";
import { HoloStage } from "./HoloStage";
import { holoShapeOf, type HoloShape } from "./holoTags";

const byNaturalName = (a: { entity: Entity }, b: { entity: Entity }) =>
  (a.entity.name ?? "").localeCompare(b.entity.name ?? "", undefined, {
    numeric: true,
  });

/**
 * A holographic HUD around every entity tagged `main` (or `main:cylinder:<axis>`, see `holoTags`):
 * glowing shells and joint gauges. Drawn with Three.js in an
 * overlay that Livelink composites onto each streamed frame, so it stays locked to the picture.
 *
 * The server renders the machine, so the browser has no depth for it: each part's shell is drawn
 * into the depth buffer, invisibly, and hides whatever of the HUD is behind it.
 *
 * Must be rendered inside a `Viewport`.
 */
export function HoloHud() {
  const { viewport } = useContext(ViewportContext);
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
    if (!viewport || parts.length === 0) {
      return;
    }

    let disposed = false;
    let frame = 0;
    let overlay: HoloOverlay | null = null;
    let stage: HoloStage | null = null;
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
        overlay = new HoloOverlay({ viewport });
        overlay.scene.add(stage.root);
        overlay.onBeforeDraw = () => {
          const elapsed = (performance.now() - start) / 1000;
          stage?.update({
            time: reducedMotion ? 0 : elapsed,
            introTime: reducedMotion ? Infinity : elapsed,
            viewportWidth: overlay!.width,
            viewportHeight: overlay!.height,
          });
        };
        viewport.addOverlay({ overlay });

        // The server only sends a frame when the scene changes; redraw the last one so the HUD
        // keeps moving while the machine is still. Under reduced motion it is static.
        const tick = () => {
          if (disposed) {
            return;
          }
          if (document.visibilityState === "visible") {
            overlay?.redraw();
          }
          frame = requestAnimationFrame(tick);
        };
        if (!reducedMotion) {
          frame = requestAnimationFrame(tick);
        } else {
          overlay.redraw();
        }
      })
      .catch((error) => console.error("HoloHud: cannot build the HUD", error));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (overlay) {
        // Releases the overlay and redraws the frame without it.
        viewport.removeOverlay({ overlay });
      }
      stage?.dispose();
    };
  }, [viewport, parts]);

  return null;
}
