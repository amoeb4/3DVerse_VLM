import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import {
  LivelinkContext,
  ViewportContext,
  useEntity,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

import { useBuildRecord } from "../../live/processFeed";
import { useSharedOverlay } from "../holo/sharedOverlay";
import type { PartMetric, Theme } from "./partColors";
import { deepPlate } from "./partGeometry";
import { PartModel, type PartPoint } from "./PartModel";
import { PartPeek } from "./PartPeek";

/** A point of the part under the pointer, and where the pointer is, in viewport pixels. */
export type PartHit = PartPoint & { x: number; y: number };

/** How much of the cell the veil hides, in Part mode: everything but the part fades. */
const VEIL_OPACITY = 0.72;
/** The camera's turn around the part, in Part mode, in radians a second. */
const ORBIT_SPEED = 0.12;
/** Seconds without touching the camera before it turns by itself again. */
const RESUME_ORBIT_S = 5;
/** How high above the part the camera looks from when it comes to it. */
const FOCUS_ELEVATION = THREE.MathUtils.degToRad(35);
/** In close-up, how near the camera comes, against the whole-part view's distance. */
const CLOSE_UP_SCALE = 0.28;
/** How fast the close-up's target catches up with the point being welded, a second. */
const CLOSE_UP_FOLLOW_RATE = 2.5;
/** A press that moves further than this, in pixels, is a drag of the camera, not a click. */
const CLICK_SLOP = 5;

type UpAxis = { axis: 0 | 1 | 2; sign: 1 | -1 };

/**
 * Where the part stands: on the build plate's top face, centred, its Y along the plate's normal,
 * in millimetres. The plate's normal is the local axis pointing up when first measured, then kept,
 * so the part turns and tilts with the positioner.
 */
function placementOn(plate: Entity, up: { current: UpAxis | null }) {
  const aabb = plate.local_aabb;
  if (!aabb) return null;
  const world = new THREE.Matrix4().fromArray(plate.ls_to_ws);
  if (!up.current) {
    let best: UpAxis = { axis: 1, sign: 1 };
    let bestDot = -Infinity;
    for (const axis of [0, 1, 2] as const) {
      const dot = new THREE.Vector3()
        .setFromMatrixColumn(world, axis)
        .normalize().y;
      if (Math.abs(dot) > bestDot) {
        bestDot = Math.abs(dot);
        best = { axis, sign: dot >= 0 ? 1 : -1 };
      }
    }
    up.current = best;
  }
  const { axis, sign } = up.current;
  const [across] = [0, 1, 2].filter((i) => i !== axis);
  const unit = (i: number) =>
    new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
  const y = unit(axis).multiplyScalar(sign);
  const x = unit(across);
  const z = new THREE.Vector3().crossVectors(x, y);
  const center = [0, 1, 2].map((i) =>
    i === axis
      ? sign > 0
        ? aabb.max[i]
        : aabb.min[i]
      : (aabb.min[i] + aabb.max[i]) / 2,
  );
  // The scene is in metres; the plate's own units may not be.
  const metresPerUnit = new THREE.Vector3()
    .setFromMatrixColumn(world, 0)
    .length();
  const perMm = 0.001 / metresPerUnit;
  const local = new THREE.Matrix4()
    .makeBasis(x, y, z)
    .scale(new THREE.Vector3(perMm, perMm, perMm))
    .setPosition(center[0], center[1], center[2]);
  return world.multiply(local);
}

/**
 * The part in construction, in the cell: drawn whole in the viewport's shared overlay, over the
 * stream, standing on the build plate and following it.
 *
 * `xray` (the Part mode): the whole cell is veiled in the background's colour, so everything
 * but the part fades; the layers still to lay show as lines; the pointer picks points of the part (`onHover`);
 * and the camera comes to the part and turns slowly around it until someone takes it, or while
 * `orbitPaused` (a past layer is shown).
 *
 * `onOpen` (the Monitor mode): the part under the pointer shows a link-like label (`PartPeek`),
 * and a click on it calls `onOpen` — opening it in Part mode.
 *
 * Must be rendered under a `SharedOverlayProvider`, inside the viewport.
 */
export function PartInCell({
  plateEuid,
  xray,
  metric,
  theme,
  shownLayer,
  focusLayer,
  onHover,
  cameraController,
  focusSignal,
  orbitPaused = false,
  closeUp = false,
  onOpen,
}: {
  plateEuid: string;
  xray: boolean;
  metric: PartMetric;
  theme: Theme;
  shownLayer: number;
  focusLayer: number | null;
  onHover: (hit: PartHit | null) => void;
  cameraController: DefaultCameraController | null;
  /** Bring the camera back to the part whenever it changes (Part mode). */
  focusSignal: number;
  /** Hold the camera still rather than turning around the part; it turns again once false. */
  orbitPaused?: boolean;
  /**
   * Part mode: the camera close up on the point being welded, turning around it and following it
   * as it moves along the layer; false, the whole part.
   */
  closeUp?: boolean;
  /** Not in `xray`: a click on the part calls it. */
  onOpen?: () => void;
}) {
  const overlay = useSharedOverlay();
  const { isConnecting, isDisconnected } = useContext(LivelinkContext);
  const { viewport } = useContext(ViewportContext);
  const { entity: plate } = useEntity({ euid: plateEuid });
  const build = useBuildRecord(500);
  const model = useMemo(
    () => new PartModel(deepPlate(build.layers)),
    [build.layers],
  );
  const placed = useRef(false);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  // Only once the scene is there: while Livelink connects (its loading panel up) or after it
  // dropped, there is no part on screen to open.
  const canOpen = Boolean(onOpen) && !xray && !isConnecting && !isDisconnected;
  const [peek, setPeek] = useState<PartHit | null>(null);

  // Read by the orbit every frame; `resumeOrbit` turns it again at once rather than after the
  // idle delay, as when the camera is let go.
  const orbitPausedRef = useRef(orbitPaused);
  const resumeOrbit = useRef<(() => void) | null>(null);
  useEffect(() => {
    orbitPausedRef.current = orbitPaused;
    if (!orbitPaused) {
      resumeOrbit.current?.();
    }
  }, [orbitPaused]);

  useEffect(() => () => model.dispose(), [model]);

  // On the plate, following it.
  useEffect(() => {
    if (!overlay || !plate) return;
    const up = { current: null as UpAxis | null };
    overlay.scene.add(model.root);
    const stop = overlay.addDrawListener(() => {
      const matrix = placementOn(plate, up);
      model.root.visible = matrix !== null;
      if (matrix) {
        model.root.matrix.copy(matrix);
        model.root.matrixWorldNeedsUpdate = true;
        placed.current = true;
      }
    });
    overlay.requestRedraw();
    return () => {
      stop();
      overlay.scene.remove(model.root);
      // Off the plate: not on screen, so not under the pointer either.
      model.root.visible = false;
      placed.current = false;
      overlay.requestRedraw();
    };
  }, [overlay, plate, model]);

  // What it shows.
  useEffect(() => {
    model.update(build);
    overlay?.requestRedraw();
  }, [model, build, overlay]);
  useEffect(() => {
    model.setMetric(metric);
    model.setTheme(theme);
    model.setShownLayer(shownLayer);
    model.setFocusLayer(focusLayer);
    model.setGhost(xray);
    overlay?.requestRedraw();
  }, [model, metric, theme, shownLayer, focusLayer, xray, overlay]);

  // Part mode: the whole cell veiled, so the part stands out.
  useVeil(overlay, xray, theme);

  // Picking, in Part mode.
  useEffect(() => {
    if (!overlay || !viewport || !xray) return;
    const element = viewport.dom_element;
    const raycaster = new THREE.Raycaster();
    let pending: { x: number; y: number } | null = null;
    let frame = 0;

    const pick = () => {
      frame = 0;
      if (!pending) return;
      const rect = element.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((pending.x - rect.left) / rect.width) * 2 - 1,
          -((pending.y - rect.top) / rect.height) * 2 + 1,
        ),
        overlay.camera,
      );
      const point = model.pick(raycaster);
      onHoverRef.current(point ? { ...point, ...pending } : null);
      overlay.requestRedraw();
    };
    const schedule = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      frame ||= requestAnimationFrame(pick);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.buttons === 0) schedule(event);
    };
    // A tap or a click shows the point there: touch screens have no hover.
    const onUp = (event: PointerEvent) => schedule(event);
    const onLeave = () => {
      pending = null;
      model.clearPick();
      onHoverRef.current(null);
      overlay.requestRedraw();
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [overlay, viewport, xray, model]);

  // Monitor: the part under the pointer, and a click on it to open it.
  useEffect(() => {
    if (!overlay || !viewport || !canOpen) return;
    const element = viewport.dom_element;
    const raycaster = new THREE.Raycaster();
    let pending: { x: number; y: number } | null = null;
    let pressedAt: { x: number; y: number } | null = null;
    let frame = 0;

    const partAt = (x: number, y: number) => {
      const rect = element.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          -((y - rect.top) / rect.height) * 2 + 1,
        ),
        overlay.camera,
      );
      return model.pick(raycaster, { mark: false });
    };
    const show = (hit: PartHit | null) => {
      setPeek(hit);
      // Over the body's cursor (`App`), while over the part.
      element.style.cursor = hit ? "pointer" : "";
    };
    const peekNow = () => {
      frame = 0;
      if (!pending) return;
      const point = partAt(pending.x, pending.y);
      show(point ? { ...point, ...pending } : null);
    };
    const onMove = (event: PointerEvent) => {
      // A mouse only: touch screens have no hover, a tap opens the part at once.
      if (event.pointerType !== "mouse") return;
      if (event.buttons !== 0) {
        // Turning the camera.
        pending = null;
        show(null);
        return;
      }
      pending = { x: event.clientX, y: event.clientY };
      frame ||= requestAnimationFrame(peekNow);
    };
    const onLeave = () => {
      pending = null;
      show(null);
    };
    // Captured: the camera controller stops the press from bubbling.
    const onDown = (event: PointerEvent) => {
      pressedAt = { x: event.clientX, y: event.clientY };
    };
    const onClick = (event: MouseEvent) => {
      const start = pressedAt;
      pressedAt = null;
      if (
        !start ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
          CLICK_SLOP ||
        !partAt(event.clientX, event.clientY)
      ) {
        return;
      }
      // Drawn over the stream, the part is in front of whatever entity is behind it: the click is
      // for the part, and Livelink's picking (a click listener on this element) does not get it.
      event.stopImmediatePropagation();
      onOpenRef.current?.();
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("pointerdown", onDown, { capture: true });
    element.addEventListener("click", onClick, { capture: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("pointerdown", onDown, { capture: true });
      element.removeEventListener("click", onClick, { capture: true });
      onLeave();
    };
  }, [overlay, viewport, canOpen, model]);

  // The camera, in Part mode: to the part, then around it.
  useEffect(() => {
    if (!xray || !cameraController || !viewport) return;
    const controller = cameraController;
    let cancelled = false;
    let frame = 0;
    let userHolds = false;
    let idleSince: number | null = null;
    let last = performance.now();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Close-up: the target, eased towards the point being welded (`weldPoint`), which the build
    // record moves on every refresh.
    const followed = new THREE.Vector3();
    const latest = new THREE.Vector3();

    const orbit = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const idle =
        !userHolds &&
        !orbitPausedRef.current &&
        (idleSince === null || now - idleSince > RESUME_ORBIT_S * 1000);
      if (idle && !reducedMotion) {
        idleSince = null;
        void controller.rotate(dt * ORBIT_SPEED, 0, false);
      }
      if (closeUp && !userHolds && model.weldPoint(latest)) {
        followed.lerp(latest, 1 - Math.exp(-dt * CLOSE_UP_FOLLOW_RATE));
        void controller.moveTo(followed.x, followed.y, followed.z, false);
      }
      frame = requestAnimationFrame(orbit);
    };

    const focus = async () => {
      // Once the part has been placed on the plate.
      while (!placed.current && !cancelled) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const projection = viewport.camera_projection;
      if (cancelled || !projection) return;
      const toWorld = model.root.matrixWorld;
      const center = new THREE.Vector3(...model.center).applyMatrix4(toWorld);
      const scale = new THREE.Vector3()
        .setFromMatrixColumn(toWorld, 0)
        .length();
      const radius = (model.size / 2) * scale;
      // From the side the camera already looks from, a little above.
      const from = new THREE.Vector3()
        .fromArray(projection.world_position)
        .sub(center);
      const across = new THREE.Vector3(from.x, 0, from.z);
      if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
      across.normalize().multiplyScalar(Math.cos(FOCUS_ELEVATION));
      const direction = across.setY(Math.sin(FOCUS_ELEVATION));
      // `clip_from_view[5]` is 1 / tan(fovY / 2): the part fills about two thirds of the height.
      const wholePart =
        radius * Math.max(1, projection.clip_from_view_matrix[5]) * 1.6;
      // Close-up: on the point being welded, nearer; the whole part when there is none yet.
      const weld = closeUp ? model.weldPoint() : null;
      const target = weld ?? center;
      const distance = weld ? wholePart * CLOSE_UP_SCALE : wholePart;
      followed.copy(target);
      await controller.travel({
        position: target
          .clone()
          .addScaledVector(direction, distance)
          .toArray() as [number, number, number],
        look_at: target.toArray() as [number, number, number],
      });
      // Turning around it, unless motion is reduced; following the weld point in close-up.
      if (!cancelled && (!reducedMotion || weld)) {
        last = performance.now();
        frame = requestAnimationFrame(orbit);
      }
    };

    const onStart = () => {
      userHolds = true;
    };
    const onEnd = () => {
      userHolds = false;
      idleSince = performance.now();
    };
    controller.addEventListener("controlstart", onStart);
    controller.addEventListener("controlend", onEnd);
    resumeOrbit.current = () => {
      idleSince = null;
    };
    void focus();
    return () => {
      cancelled = true;
      resumeOrbit.current = null;
      cancelAnimationFrame(frame);
      controller.removeEventListener("controlstart", onStart);
      controller.removeEventListener("controlend", onEnd);
    };
  }, [xray, cameraController, viewport, model, focusSignal, closeUp]);

  // Out of the viewport, whose overlays are laid out against it, and over the panels.
  return peek
    ? createPortal(<PartPeek x={peek.x} y={peek.y} />, document.body)
    : null;
}

//------------------------------------------------------------------------------
/**
 * The cell veiled, in Part mode: a quad over the whole frame, in the background's colour at
 * `VEIL_OPACITY`, drawn first in the overlay so the part is drawn over it, unveiled.
 *
 * The server renders the cell, so the browser cannot make its entities transparent: it veils the
 * picture instead. Over the background, which is that same colour, the veil changes nothing; over
 * every entity, it fades it — the robot, the positioner, the walls alike.
 *
 * Transparent, so Three.js sorts it with the part (transparent too) and draws it first by its
 * render order; whatever opaque the overlay holds would be drawn before it, and veiled.
 */
function useVeil(
  overlay: ReturnType<typeof useSharedOverlay>,
  on: boolean,
  theme: Theme,
) {
  const veil = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) },
        opacity: { value: VEIL_OPACITY },
      },
      // The quad is already in clip space: it covers the frame whatever the camera.
      vertexShader:
        "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader:
        "uniform vec3 color; uniform float opacity; void main() { gl_FragColor = vec4(color, opacity); }",
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    mesh.visible = false;
    return { mesh, material };
  }, []);

  useEffect(() => {
    if (!overlay) return;
    overlay.scene.add(veil.mesh);
    overlay.requestRedraw();
    return () => {
      veil.mesh.removeFromParent();
      overlay.requestRedraw();
    };
  }, [overlay, veil]);

  useEffect(() => {
    veil.mesh.visible = on;
    // White and black read the same in any colour space.
    (veil.material.uniforms.color.value as THREE.Color).set(
      theme === "dark" ? 0x000000 : 0xffffff,
    );
    overlay?.requestRedraw();
  }, [veil, on, theme, overlay]);

  useEffect(
    () => () => {
      veil.mesh.geometry.dispose();
      veil.material.dispose();
    },
    [veil],
  );
}
