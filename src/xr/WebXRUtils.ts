//------------------------------------------------------------------------------
import { Livelink } from "@3dverse/livelink";
import {
  XRLivelink,
  LXRScaleUp,
  LXRScaleDown,
  LXR_DEFAULT_ACTION_MAP,
  type LXRButtonActionState,
} from "@3dverse/livelink-webxr";

//------------------------------------------------------------------------------
import type { SceneAABB } from "./sceneAABB";
import { XRReticle } from "./XRReticle";
import { XRHeadsetUI } from "./XRHeadsetUI";
import { waitForCameras } from "./utils";
import { controllerBindings } from "./controllerBindings";
import { isVlaunchClipApp, xrHudForced } from "./searchParams";
import { useXRSettingsStore } from "./stores";

//------------------------------------------------------------------------------
/**
 * An XR session's glue between the library and this app, from 3dverse-mobile-viewer's
 * livelink/WebXRUtils.ts: placement, the in-headset menu, and what the controller actions mean
 * (scale, speed, place). Built by `CameraControllerWebXR`, published to `useWebXRStore`.
 */
//------------------------------------------------------------------------------
export class WebXRUtils {
  //--------------------------------------------------------------------------
  /**
   * User speed multiplier, doubled and halved by the speed-up / speed-down bindings. 1 is the
   * speed the camera speed slider asks for.
   *
   * Deliberately not derived from {@link sceneAABB}: some scenes carry a bounding box far larger
   * than their visible content, which would make the relative move unusably fast.
   */
  moveFactor = 1;

  /**
   * The first camera speed seen after this session started, in the units of {@link speedMultiplier}
   * — written once by a speed slider, where there is one, and never again. Everything is expressed relative to it, so
   * moving the slider mid-session moves the user proportionally rather than resetting what "1" means.
   */
  get initialMoveFactor(): number | undefined {
    return this._initialMoveFactor;
  }

  set initialMoveFactor(value: number | undefined) {
    this._initialMoveFactor = value;
    this.updateSpeedScale();
  }

  /** Scene units per second one point of camera speed is worth. */
  readonly speedMultiplier = 0.002;

  //--------------------------------------------------------------------------
  readonly livelink: Livelink;
  readonly livelinkXR: XRLivelink;
  readonly sceneAABB: SceneAABB;

  //--------------------------------------------------------------------------
  private _unregisterFrameCallback?: () => void;

  //--------------------------------------------------------------------------
  /** The placement reticle, when this session can place anything. See {@link initPlacement}. */
  private _reticle?: XRReticle;

  //--------------------------------------------------------------------------
  /** The in-headset menu, when nothing in the DOM can be seen. See {@link initHeadsetUI}. */
  private _headsetUI?: XRHeadsetUI;

  //--------------------------------------------------------------------------
  private _anchorAabbBottom = true;

  //--------------------------------------------------------------------------
  /** Latest camera speed reported by the app's speed slider. See {@link cameraSpeed}. */
  private _cameraSpeed?: number;

  //--------------------------------------------------------------------------
  private _initialMoveFactor?: number;

  //--------------------------------------------------------------------------
  get session() {
    return this.livelinkXR.xr_session!;
  }

  //--------------------------------------------------------------------------
  get isAR() {
    return this.livelinkXR.xr_mode === "immersive-ar";
  }

  //--------------------------------------------------------------------------
  constructor(
    livelink: Livelink,
    livelinkXR: XRLivelink,
    sceneAABB: SceneAABB,
  ) {
    this.livelink = livelink;
    this.livelinkXR = livelinkXR;
    this.sceneAABB = sceneAABB;

    if (!livelinkXR.xr_session) {
      throw new Error("No XR session running");
    }
  }

  //--------------------------------------------------------------------------
  async init() {
    // Nothing reports when the viewports and their cameras are ready — see `waitForCameras`.
    await waitForCameras(this.livelink);

    await this.setDefaultCameraSettings();
    // This app's own map, before anything reads it: no grip control (`controllerBindings`).
    this.livelinkXR.actions.bindings = controllerBindings(
      LXR_DEFAULT_ACTION_MAP,
      this.livelinkXR.xr_mode,
    );
    this.initPlacement();
    this.initHeadsetUI();

    // The HUD may have set the speed before the session was ready, or not exist at all — in a
    // headset the DOM is not composited, so nothing there will ever write it.
    this.updateSpeedScale();

    this.startActionHandlers();

    useXRSettingsStore
      .getState()
      .setHasFakeAlpha(this.livelinkXR.enable_fake_alpha);
  }

  //--------------------------------------------------------------------------
  /**
   * Composite the scene over the passthrough (the model fades into the room), or draw it opaque.
   *
   * Fake alpha lives on the XR session rather than on the camera; the store only mirrors it. The
   * cameras' background goes with it: black is what the passthrough shows through.
   */
  setFakeAlpha(enabled: boolean) {
    this.livelinkXR.enable_fake_alpha = enabled;
    this.livelink.viewports.forEach((viewport) => {
      const camera = viewport.camera_projection?.camera_entity;
      if (camera?.camera) {
        camera.camera.dataJSON.displayBackground = !enabled;
      }
    });
    useXRSettingsStore.getState().setHasFakeAlpha(enabled);
  }

  //--------------------------------------------------------------------------
  release() {
    // Unregistered before anything else: left armed, it re-arms itself every frame and throws
    // once the session is gone.
    this._unregisterFrameCallback?.();
    this._unregisterFrameCallback = undefined;

    this._reticle?.release();
    this._reticle = undefined;

    this._headsetUI?.release();
    this._headsetUI = undefined;

    this.stopScaleHold();
  }

  //--------------------------------------------------------------------------
  /**
   * Hand the library the two things about placement that are this application's to know.
   *
   * The hit test itself, the anchor lifecycle and the rig anchor are the library's — see
   * `LXRPlacement`, whose source is already up by the time this runs. What is left here is the
   * scene's own geometry, one device quirk, and what the user is shown while aiming.
   */
  private initPlacement() {
    const { placement } = this.livelinkXR;

    // If variant launch then anchor are supported but does not work so far:
    // https://discord.com/channels/902911459988733982/1357358835601248317
    placement.enable_anchors = !isVlaunchClipApp;

    this.applyAnchorReference();

    // Drawn into the XR framebuffer rather than into the DOM, so it exists in a headset too:
    // `dom-overlay` is granted on a phone and nowhere else. `is_available` is settled by the time
    // the session hands us over, so there is nothing to wait for.
    if (this.isAR && placement.is_available) {
      this._reticle = new XRReticle(this.livelinkXR);
    }
  }

  //--------------------------------------------------------------------------
  /**
   * Give the session its own menu when the DOM cannot be seen from inside it — see
   * {@link XRHeadsetUI} for why a headset needs one.
   *
   * Built after {@link initPlacement} because the panel decides at construction whether it carries a
   * Place item, and `placement.is_available` is what says so.
   */
  private initHeadsetUI() {
    // The override exists because the one place a desktop can exercise a controller — the
    // Immersive Web Emulator — emulates the device and not the page, so the DOM overlay it
    // reports would switch the whole menu off exactly where it can be tested.
    if (this.livelinkXR.has_dom_overlay && !xrHudForced) {
      return;
    }

    this._headsetUI = new XRHeadsetUI(this);
  }

  //--------------------------------------------------------------------------
  /**
   * What lands on the detected surface: the bottom of the scene's bounding box, so the model
   * stands on it, or the scene's own origin.
   *
   * This is the whole of what the library's `content_offset` parameter means to this app — it has
   * no idea what a scene AABB is, and does not need one.
   */
  get anchorAabbBottom(): boolean {
    return this._anchorAabbBottom;
  }

  //--------------------------------------------------------------------------
  set anchorAabbBottom(value: boolean) {
    this._anchorAabbBottom = value;
    this.applyAnchorReference();
  }

  //--------------------------------------------------------------------------
  /** Push {@link anchorAabbBottom} to the library and move what is already placed accordingly. */
  private applyAnchorReference() {
    const { placement } = this.livelinkXR;
    placement.content_offset = this._anchorAabbBottom
      ? this.sceneAABB.faceCenter.bottom
      : [0, 0, 0];
    placement.recomputePosition();
  }

  //--------------------------------------------------------------------------
  startActionHandlers() {
    const { xr_session } = this.livelinkXR;
    if (!xr_session) {
      throw new Error("No XR session running");
    }
    console.debug("Starting webxr action handlers");

    // The `input` phase of the session's single frame loop, which runs before the camera rig is
    // composed and drawn. Physical thumbsticks drive locomotion from here, so a chain of our own
    // would have applied it either side of the frame that renders it, at the user agent's whim.
    this._unregisterFrameCallback = this.livelinkXR.addFrameCallback({
      phase: "input",
      callback: this._onXRFrame,
    });
  }

  //--------------------------------------------------------------------------
  /**
   * Apply this frame's actions.
   *
   * Every binding this app has lives in the library's action map, keyed by profile component id
   * rather than by controller class, so what is left here is only what the actions mean to this
   * application. See `LXR_DEFAULT_ACTION_MAP`.
   */
  private _onXRFrame = () => {
    // Resolved by the library ahead of this phase, from input sources polled ahead of that, so
    // everything read below is this frame's. Locomotion — move, turn, rise and sink — is not
    // here: `livelinkXR.locomotion` applies it after this phase, through the same conditioners
    // and speeds the virtual joysticks go through.
    const { actions } = this.livelinkXR;

    if (actions.getButton("speed-up").event === "down") {
      this.speedUp(2);
    }
    if (actions.getButton("speed-down").event === "down") {
      this.speedDown(2);
    }

    this._applyScaleHold("up", actions.getButton("scale-up"));
    this._applyScaleHold("down", actions.getButton("scale-down"));

    if (actions.getButton("place").event === "down") {
      this.livelinkXR.placement.place();
    }
  };

  //--------------------------------------------------------------------------
  /**
   * Start or stop the hold-to-scale timers from one scale action's edges.
   *
   * The action goes inactive as soon as its binding stops applying, not only when the button is
   * released, so letting go of the stick while holding a face button also ends the hold.
   */
  private _applyScaleHold(
    direction: "up" | "down",
    action: Readonly<LXRButtonActionState>,
  ) {
    if (action.event === "down") {
      this.startScaleHold(direction);
    } else if (action.event === "up") {
      this.stopScaleHold();
    }
  }

  //--------------------------------------------------------------------------
  setDefaultCameraSettings = async () => {
    const { isAR } = this;

    this.livelink.viewports.forEach((viewport) => {
      const camera = viewport.camera_projection?.camera_entity;
      if (!camera?.camera) {
        console.error("No camera entity for viewport", viewport);
        return;
      }

      if (isAR) {
        // Passthrough composites black as transparent, so the background has to be pure black —
        // the environment map is still processed, and still lights reflections. The grid would
        // be drawn over the real world, and bloom would halo every near-black pixel of it.
        camera.camera!.dataJSON.displayBackground = false;
        camera.camera!.dataJSON.grid = false;
        camera.camera!.dataJSON.bloom = false;
      }
      console.debug("set viewport camera settings", camera.camera);
    });
  };

  //--------------------------------------------------------------------------
  /**
   * The camera speed the app's speed slider is showing.
   *
   * The slider lives in React and the locomotion controller in the library, so this is the seam
   * between them: the HUD writes it, and everything that moves the user — physical thumbsticks
   * and virtual joysticks alike — is scaled by it.
   */
  get cameraSpeed(): number | undefined {
    return this._cameraSpeed;
  }

  //--------------------------------------------------------------------------
  set cameraSpeed(value: number | undefined) {
    this._cameraSpeed = value;
    this.updateSpeedScale();
  }

  //--------------------------------------------------------------------------
  /**
   * Hand the locomotion controller the one speed scale both input paths run through — the virtual
   * joysticks and the physical thumbsticks alike. It is the slider's change since the HUD mounted,
   * times the user's speed-up / speed-down multiplier.
   */
  private updateSpeedScale() {
    const { initialMoveFactor, _cameraSpeed } = this;
    const sliderScale =
      initialMoveFactor && _cameraSpeed !== undefined
        ? (_cameraSpeed * this.speedMultiplier) / initialMoveFactor
        : 1;

    this.livelinkXR.locomotion.speed_scale = sliderScale * this.moveFactor;
  }

  //--------------------------------------------------------------------------
  speedUp(factor: number) {
    this.moveFactor *= factor;
    this.updateSpeedScale();
  }

  //--------------------------------------------------------------------------
  speedDown(factor: number) {
    this.moveFactor /= factor;
    this.updateSpeedScale();
  }

  //--------------------------------------------------------------------------
  setScale(scale: number) {
    this.livelinkXR.camera_rig.scale = scale;
    this.livelinkXR.placement.recomputePosition();
  }

  //--------------------------------------------------------------------------
  /** Diagonal of a cube of 1 m sides. */
  static readonly ONE_CUBIC_METER_DIAGONAL = Math.sqrt(3);

  //--------------------------------------------------------------------------
  /**
   * Compute and apply the scale that fits the scene's AABB diagonal into the diagonal of a 1 cubic meter cube.
   *
   * @returns The new scale factor.
   */
  fitToOneCubicMeter() {
    const { diagonalLength } = this.sceneAABB;
    const scale =
      diagonalLength > 0
        ? WebXRUtils.ONE_CUBIC_METER_DIAGONAL / diagonalLength
        : 1;
    this.setScale(scale);
    return scale;
  }

  //--------------------------------------------------------------------------
  // Hold-to-scale — shared by UI buttons and physical XR controllers
  //--------------------------------------------------------------------------
  private _scaleHoldTimeout: ReturnType<typeof setTimeout> | null = null;
  private _scaleHoldInterval: ReturnType<typeof setInterval> | null = null;

  static readonly SCALE_HOLD_DELAY_MS = 300;
  static readonly SCALE_HOLD_INTERVAL_MS = 50;
  /** Proportional rate per interval tick (2% of current scale). */
  static readonly SCALE_HOLD_RATE = 0.02;

  //--------------------------------------------------------------------------
  stopScaleHold() {
    if (this._scaleHoldTimeout !== null) {
      clearTimeout(this._scaleHoldTimeout);
      this._scaleHoldTimeout = null;
    }
    if (this._scaleHoldInterval !== null) {
      clearInterval(this._scaleHoldInterval);
      this._scaleHoldInterval = null;
    }
  }

  //--------------------------------------------------------------------------
  startScaleHold(direction: "down" | "up") {
    this._scaleHoldTimeout = setTimeout(() => {
      this._scaleHoldTimeout = null;
      this._scaleHoldInterval = setInterval(() => {
        const current = this.livelinkXR.camera_rig.scale;
        const step = Math.abs(current) * WebXRUtils.SCALE_HOLD_RATE;
        const next = direction === "down" ? current - step : current + step;
        this.setScale(Math.max(0.01, next));
      }, WebXRUtils.SCALE_HOLD_INTERVAL_MS);
    }, WebXRUtils.SCALE_HOLD_DELAY_MS);
  }

  //--------------------------------------------------------------------------
  /** Returns the new scale, for the caller to display. */
  scaleUp(): number {
    const scale = LXRScaleUp(this.livelinkXR.camera_rig, {
      compensate_anchor_position: !this.isAR,
    });
    this.livelinkXR.placement.recomputePosition();
    return scale;
  }

  //--------------------------------------------------------------------------
  /** Returns the new scale, for the caller to display. */
  scaleDown(): number {
    const scale = LXRScaleDown(this.livelinkXR.camera_rig, {
      compensate_anchor_position: !this.isAR,
    });
    this.livelinkXR.placement.recomputePosition();
    return scale;
  }
}
