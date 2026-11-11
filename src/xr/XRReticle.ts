//------------------------------------------------------------------------------
import { Matrix4 } from "three";
import {
  LXRQuad,
  LXRTexture,
  type LXRFrameCallbackArgs,
  type XRLivelink,
} from "@3dverse/livelink-webxr";

//------------------------------------------------------------------------------
/** Real-world radius the reticle aims for, in metres. */
const RETICLE_RADIUS_M = 0.15;

//------------------------------------------------------------------------------
// The projected-size clamp: a fixed real-world radius is a few pixels across at six metres and fills
// the view at arm's length. A share of the viewport height rather than a pixel count, so the bounds
// hold against both a phone's framebuffer and a headset's much taller one.
const MIN_PROJECTED_RADIUS_RATIO = 0.03;
const MAX_PROJECTED_RADIUS_RATIO = 0.175;

//------------------------------------------------------------------------------
/** Side of the artwork, in texels. Sized for the largest the clamp above will ever draw it. */
const TEXTURE_SIZE_PX = 512;

//------------------------------------------------------------------------------
/** Anything at or behind the near plane cannot be projected. */
const MIN_VIEW_DEPTH_M = 0.01;

//------------------------------------------------------------------------------
/** Seconds the reticle takes to fade in or out. */
const FADE_SECONDS = 0.15;

//------------------------------------------------------------------------------
// The hit pose's +Y is the surface normal and a quad's is its +Z, so the artwork is laid flat onto
// the surface by a quarter turn about X.
const LIE_FLAT = new Matrix4().makeRotationX(-Math.PI / 2);

//------------------------------------------------------------------------------
/**
 * The AR placement reticle: a ring lying on the surface the hit test has found, marking where the
 * model will land when the place button is pressed.
 *
 * A quad in the XR framebuffer rather than a DOM element, for the reason given on {@link XRHeadsetUI}
 * — passthrough AR in a headset included.
 */
export class XRReticle {
  //--------------------------------------------------------------------------
  private readonly _livelinkXR: XRLivelink;
  private readonly _texture: LXRTexture;
  private readonly _quad: LXRQuad;
  private _unregisterFrameCallback?: () => void;

  //--------------------------------------------------------------------------
  /** Current fade position, in `[0, 1]`. */
  private _opacity = 0;

  //--------------------------------------------------------------------------
  /** Whether the quad's pose is one the current frame produced. */
  private _hasPose = false;

  //--------------------------------------------------------------------------
  // Scratch matrices — this runs on every XR frame, so nothing here allocates.
  private readonly _hit = new Matrix4();
  private readonly _view = new Matrix4();
  private readonly _model = new Matrix4();
  private readonly _hitInView = new Matrix4();

  //--------------------------------------------------------------------------
  /**
   * @param livelinkXR The session to draw in. Its placement must be available — there is nothing
   * to aim with otherwise.
   */
  constructor(livelinkXR: XRLivelink) {
    this._livelinkXR = livelinkXR;

    this._texture = new LXRTexture({
      width: TEXTURE_SIZE_PX,
      height: TEXTURE_SIZE_PX,
    });
    drawReticleArtwork(this._texture);

    this._quad = new LXRQuad({ texture: this._texture, z_order: 0 });
    this._quad.visible = false;
    this._quad.opacity = 0;
    livelinkXR.overlay.add(this._quad);

    // The `anchor` phase, after the library's placement update: the hit pose read here is this
    // frame's, and the quad is drawn a few lines later in the same frame.
    this._unregisterFrameCallback = livelinkXR.addFrameCallback({
      phase: "anchor",
      callback: this._onXRFrame,
    });
  }

  //--------------------------------------------------------------------------
  release() {
    this._unregisterFrameCallback?.();
    this._unregisterFrameCallback = undefined;
    this._livelinkXR.overlay.remove(this._quad);
    this._texture.release();
  }

  //--------------------------------------------------------------------------
  private _onXRFrame = ({ viewer_pose, dt }: LXRFrameCallbackArgs) => {
    // Tracking loss returns no viewer pose, and there is then nothing truthful to draw. The hit
    // pose survives a frame that missed, so `has_surface` is what says whether it is still the
    // surface the user is pointing at.
    const { placement } = this._livelinkXR;
    const view = viewer_pose?.views[0];
    const hitPose = placement.hit_pose;
    const isOnSurface =
      !!view &&
      !!hitPose &&
      placement.has_surface &&
      this._updatePose(view, hitPose);

    this._fade({ target: isOnSurface ? 1 : 0, dt });
  };

  //--------------------------------------------------------------------------
  /**
   * Place and size the quad on the surface for this frame.
   *
   * @returns False when the hit point cannot be projected, in which case nothing was written.
   */
  private _updatePose(view: XRView, hitPose: XRPose): boolean {
    this._hit.fromArray(hitPose.transform.matrix as unknown as number[]);
    this._view.fromArray(view.transform.inverse.matrix as unknown as number[]);

    // View space looks down -Z, so the depth of the hit point is the negated translation of the
    // hit pose expressed in it.
    this._hitInView.multiplyMatrices(this._view, this._hit);
    const depth = -this._hitInView.elements[14];
    if (!(depth > MIN_VIEW_DEPTH_M)) {
      return false;
    }

    // `projectionMatrix[5]` is `1 / tan(fovY / 2)`, i.e. the height of the viewport in NDC units
    // one metre covers at one metre; halved because NDC spans [-1, 1], and divided by the
    // distance, at this distance.
    const heightRatioPerMeter = view.projectionMatrix[5] / (2 * depth);
    if (!Number.isFinite(heightRatioPerMeter) || heightRatioPerMeter <= 0) {
      return false;
    }

    const radius = clampRadius(RETICLE_RADIUS_M, heightRatioPerMeter);
    this._model.multiplyMatrices(this._hit, LIE_FLAT);
    this._quad.matrix.set(this._model.elements);
    this._quad.width = 2 * radius;
    this._quad.height = 2 * radius;
    this._hasPose = true;
    return true;
  }

  //--------------------------------------------------------------------------
  /**
   * Ease the reticle in and out rather than popping it, the way the DOM element's CSS transition
   * did. A hit test that drops for a frame is common enough that a hard cut reads as a flicker.
   */
  private _fade({ target, dt }: { target: number; dt: number }) {
    if (dt > 0) {
      const step = dt / FADE_SECONDS;
      const delta = target - this._opacity;
      this._opacity +=
        Math.abs(delta) <= step ? delta : Math.sign(delta) * step;
    } else {
      this._opacity = target;
    }

    // Faded out completely: stop drawing it, and stop trusting the pose it last held.
    if (this._opacity <= 0) {
      this._opacity = 0;
      this._hasPose = false;
    }

    this._quad.opacity = this._opacity;
    this._quad.visible = this._hasPose && this._opacity > 0;
  }
}

//------------------------------------------------------------------------------
/**
 * Draw the ring, once, into the texture the quad samples.
 *
 * The same three circles the SVG had, in the same proportions — the artwork is authored against a
 * 200-unit box and scaled to whatever the texture is, so the outer ring still sits at 94% of the
 * quad's half-width rather than flush against its edge.
 */
function drawReticleArtwork(texture: LXRTexture) {
  const context = texture.context_2d;
  if (!context) {
    return;
  }

  const { width, height } = texture;
  const unit = width / 200;
  const centerX = width / 2;
  const centerY = height / 2;

  context.clearRect(0, 0, width, height);

  // Legibility over bright passthrough: the DOM element carried the same shadow as a CSS filter.
  context.shadowColor = "rgba(0, 0, 0, 0.6)";
  context.shadowBlur = 4 * unit;

  context.globalAlpha = 0.9;
  context.strokeStyle = "white";
  context.lineWidth = 6 * unit;
  context.beginPath();
  context.arc(centerX, centerY, 94 * unit, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 0.12;
  context.fillStyle = "white";
  context.beginPath();
  context.arc(centerX, centerY, 70 * unit, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.9;
  context.beginPath();
  context.arc(centerX, centerY, 10 * unit, 0, Math.PI * 2);
  context.fill();

  texture.markDirty();
}

//------------------------------------------------------------------------------
/**
 * The radius that keeps the reticle inside the projected-size bounds, in metres.
 *
 * @param radiusM The radius aimed for.
 * @param heightRatioPerMeter Share of the viewport height one metre covers at the hit distance.
 */
function clampRadius(radiusM: number, heightRatioPerMeter: number): number {
  const projected = radiusM * heightRatioPerMeter;
  if (projected < MIN_PROJECTED_RADIUS_RATIO) {
    return MIN_PROJECTED_RADIUS_RATIO / heightRatioPerMeter;
  }
  if (projected > MAX_PROJECTED_RADIUS_RATIO) {
    return MAX_PROJECTED_RADIUS_RATIO / heightRatioPerMeter;
  }
  return radiusM;
}
