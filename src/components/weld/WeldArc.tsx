import { useContext, useEffect, useRef } from "react";
import {
  LivelinkContext,
  ViewportContext,
  useEntity,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

import { useIsWelding } from "../../live/weldLog";
import { WeldArcEffect } from "./arcEffect";
import { TORCH_EUID } from "./torch";

//------------------------------------------------------------------------------
/**
 * The arc's light on the scene itself: a point light on the torch tip, rendered by the server, so
 * the workpiece and the cell turn blue around the arc — for everyone in the session.
 *
 * Calibrated against NJ130's own lights (sun 10, point lights 10): at 4 W/sr the arc outshines the
 * sun on the plate (≈44 at 30 cm) and falls back to it around 60 cm.
 */
const ARC_LIGHT_COLOR: [number, number, number] = [0.42, 0.62, 1];
const ARC_LIGHT_INTENSITY = 4;
const ARC_LIGHT_RANGE = 2.5;
/** Each change of the light is a message to the server: its flicker is sent at ~11 Hz, not per frame. */
const ARC_LIGHT_UPDATE_MS = 90;

/**
 * The welding arc at the torch tip while "Start Weld" is on: blue glare, spatter, the pool's
 * afterglow and a subtle fume — see `WeldArcEffect` — plus the arc's real light on the scene.
 *
 * `sceneLight` (the View menu's "Arc light") turns the light on the scene off, keeping the glare.
 * The light is an entity of the shared scene: off here, the cell is unlit for everyone.
 *
 * Must be rendered inside a `Viewport`.
 */
export function WeldArc({ sceneLight = true }: { sceneLight?: boolean }) {
  const { instance } = useContext(LivelinkContext);
  const { camera } = useContext(ViewportContext);
  const { entity: torch } = useEntity({ euid: TORCH_EUID });
  const welding = useIsWelding();

  const smokeRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLCanvasElement>(null);
  const effectRef = useRef<WeldArcEffect | null>(null);

  // Frame loop: runs while welding, and on until the last spark has fallen and the fume cleared.
  useEffect(() => {
    const smokeCanvas = smokeRef.current;
    const lightCanvas = lightRef.current;
    const smoke = smokeCanvas?.getContext("2d");
    const light = lightCanvas?.getContext("2d");
    if (!smokeCanvas || !lightCanvas || !smoke || !light) {
      return;
    }

    effectRef.current ??= new WeldArcEffect({
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    });
    const effect = effectRef.current;
    effect.welding = welding;
    if (!effect.isActive) {
      return;
    }

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const position = torch?.global_transform?.position;
      effect.update(
        dt,
        now,
        position ? [position[0], position[1], position[2]] : null,
      );

      // Canvas backing store follows its CSS size and the screen's pixel density.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = smokeCanvas.clientWidth;
      const height = smokeCanvas.clientHeight;
      for (const canvas of [smokeCanvas, lightCanvas]) {
        const w = Math.round(width * dpr);
        const h = Math.round(height * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      }
      smoke.setTransform(dpr, 0, 0, dpr, 0, 0);
      light.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (camera && width > 0 && height > 0) {
        effect.draw(light, smoke, {
          clipFromWorld: camera.clip_from_world_matrix,
          focalY: camera.clip_from_view_matrix[5],
          width,
          height,
        });
      }

      if (effect.isActive) {
        frame = requestAnimationFrame(tick);
      } else {
        smoke.clearRect(0, 0, width, height);
        light.clearRect(0, 0, width, height);
      }
    };
    frame = requestAnimationFrame(tick);

    // When welding stops, this loop is replaced by one that carries on until everything has
    // settled — the effect keeps its particles, so nothing jumps.
    return () => cancelAnimationFrame(frame);
  }, [welding, torch, camera]);

  // The arc's light on the scene, while welding.
  useEffect(() => {
    if (!sceneLight || !welding || !torch || !instance) {
      return;
    }
    let disposed = false;
    let arcLight: Entity | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    instance.scene
      .newEntity({
        name: "Weld arc light",
        parent: torch,
        components: {
          local_transform: { position: [0, 0.005, 0] },
          point_light: {
            color: ARC_LIGHT_COLOR,
            intensity: ARC_LIGHT_INTENSITY,
            range: ARC_LIGHT_RANGE,
          },
        },
        // Never left burning in the shared scene if this tab goes away mid-weld.
        options: { delete_on_client_disconnection: true },
      })
      .then((entity) => {
        if (disposed) {
          void instance.scene.deleteEntities({ entities: [entity] });
          return;
        }
        arcLight = entity;
        timer = setInterval(() => {
          const level = effectRef.current?.intensity ?? 1;
          if (arcLight?.point_light) {
            arcLight.point_light.intensity = ARC_LIGHT_INTENSITY * level;
          }
        }, ARC_LIGHT_UPDATE_MS);
      })
      .catch((error) =>
        console.error("WeldArc: cannot create the arc light", error),
      );

    return () => {
      disposed = true;
      clearInterval(timer);
      if (arcLight) {
        void instance.scene
          .deleteEntities({ entities: [arcLight] })
          .catch((error) =>
            console.error("WeldArc: cannot remove the arc light", error),
          );
      }
    };
  }, [sceneLight, welding, torch, instance]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <canvas ref={smokeRef} className="absolute inset-0 size-full" />
      <canvas
        ref={lightRef}
        className="absolute inset-0 size-full mix-blend-screen"
      />
    </div>
  );
}
