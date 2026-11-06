import * as THREE from "three";
import type { OverlayInterface, Viewport } from "@3dverse/livelink";

/**
 * A Three.js scene composited by Livelink on top of every frame the server streams into a viewport.
 *
 * Livelink calls `draw` whenever it presents a frame, so the overlay's camera is copied from the
 * viewport's camera projection at that exact moment — the HUD can never drift from the picture it
 * is drawn over. Between server frames, `HoloHud` asks for a redraw of the last frame so the HUD
 * keeps animating while the scene itself is still.
 *
 * Same principle as `@3dverse/livelink-three`'s `ThreeOverlay`, plus a per-draw hook (`onBeforeDraw`)
 * where the HUD follows the entities and advances its animations.
 */
export class HoloOverlay implements OverlayInterface {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera();

  /** Called right before each render, with the overlay's camera already synced to the viewport. */
  onBeforeDraw: ((viewport: Viewport) => void) | null = null;

  readonly #viewport: Viewport;
  readonly #canvas: OffscreenCanvas;
  readonly #renderer: THREE.WebGLRenderer;
  #warned = false;

  constructor({ viewport }: { viewport: Viewport }) {
    this.#viewport = viewport;
    this.#canvas = new OffscreenCanvas(
      Math.max(1, viewport.width),
      Math.max(1, viewport.height),
    );
    const context = this.#canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!context) {
      throw new Error("HoloOverlay: cannot create a WebGL2 context");
    }
    this.#renderer = new THREE.WebGLRenderer({
      canvas: this.#canvas,
      context,
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.setPixelRatio(1);
    this.#renderer.setSize(this.#canvas.width, this.#canvas.height, false);
    this.camera.matrixAutoUpdate = false;
  }

  get width() {
    return this.#canvas.width;
  }

  get height() {
    return this.#canvas.height;
  }

  draw({
    output_canvas,
  }: {
    output_canvas: OffscreenCanvas | null;
  }): OffscreenCanvas | null {
    const projection = this.#viewport.camera_projection;
    if (!projection) {
      return null;
    }
    if (output_canvas) {
      // Another overlay already drew into its own canvas, and Livelink composites only one.
      if (!this.#warned) {
        console.warn(
          "HoloOverlay: another canvas overlay is active; the HUD is not drawn",
        );
        this.#warned = true;
      }
      return null;
    }

    this.camera.position.fromArray(projection.world_position);
    this.camera.quaternion.fromArray(projection.world_orientation);
    this.camera.updateMatrix();
    this.camera.updateMatrixWorld(true);
    this.camera.projectionMatrix.fromArray(projection.clip_from_view_matrix);
    this.camera.projectionMatrixInverse.fromArray(
      projection.view_from_clip_matrix,
    );

    this.onBeforeDraw?.(this.#viewport);

    this.#renderer.setViewport(0, 0, this.#canvas.width, this.#canvas.height);
    this.#renderer.render(this.scene, this.camera);
    return this.#canvas;
  }

  resize({ width, height }: { width: number; height: number }) {
    this.#canvas.width = Math.max(1, width);
    this.#canvas.height = Math.max(1, height);
    this.#renderer.setSize(this.#canvas.width, this.#canvas.height, false);
  }

  /** Re-present the last streamed frame, so the HUD animates while the scene is still. */
  redraw() {
    this.#viewport.rendering_surface.redrawLastFrame();
  }

  /** Called by `viewport.removeOverlay`. The scene's content belongs to whoever added it. */
  release() {
    this.onBeforeDraw = null;
    this.#renderer.dispose();
  }
}
