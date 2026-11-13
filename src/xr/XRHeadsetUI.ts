//------------------------------------------------------------------------------
import {
  LXRPanel,
  LXR_DEFAULT_ACTION_MAP,
  computeLXRPanelHeight,
  type LXRBinding,
  type LXRPanelAttachment,
  type LXRPanelItem,
  type LXRPanelItemPart,
} from "@3dverse/livelink-webxr";

//------------------------------------------------------------------------------
import { useMiniToastStore } from "./stores";
import { controllerBindings } from "./controllerBindings";
import { formatScale } from "./utils";
import type { WebXRUtils } from "./WebXRUtils";

//------------------------------------------------------------------------------
/** Ids of the panel items. */
const ITEM_SCALE = "scale";
const ITEM_FIT = "fit";
const ITEM_PLACE = "place";
const ITEM_TURN = "turn";
const ITEM_COMFORT = "comfort";
const ITEM_PIN = "pin";
const ITEM_EXIT = "exit";
const ITEM_STATUS = "status";

//------------------------------------------------------------------------------
const PANEL_TITLE = "VLM Dimension";

//------------------------------------------------------------------------------
/**
 * Width of the panel artwork, in texels. The height follows from the items through
 * `computeLXRPanelHeight`, because a panel's canvas cannot be resized once it is built — so the item
 * *set* is fixed for a panel's life, while labels, values and enabled states change freely.
 */
const PANEL_WIDTH_PX = 420;

//------------------------------------------------------------------------------
// Real-world widths. The wrist panel is smaller because it is held at wrist distance and has to
// fit on a forearm; the pinned one sits at arm's length and can afford the room.
const WRIST_WIDTH_M = 0.18;
const PINNED_WIDTH_M = 0.3;

//------------------------------------------------------------------------------
// Above the reticle's 0, and the pinned panel above the wrist one, so that a pinned panel drawn
// across a raised wrist reads as being in front of it. The pointer draws its cursor one order
// above the panel it is on and its laser one below, which leaves room between these two.
const WRIST_Z_ORDER = 10;
const PINNED_Z_ORDER = 20;

//------------------------------------------------------------------------------
/**
 * Where the wrist panel sits relative to the grip pose.
 *
 * Grip space has `-z` pointing the way the hand holds something and `+y` out of the back of the
 * hand, so the quarter turn about X below puts the panel's face (`+z`) out of the back of the hand
 * and its up (`+y`) towards the fingertips — a panel read from wrist to knuckles, revealed by
 * turning the wrist over. The offset raises it off the skin and slides it back towards the wrist.
 *
 * Tuned against a controller grip pose. A tracked hand reports a different one, which is one of the
 * things only a device can settle.
 */
const WRIST_OFFSET = {
  position: [0, 0.04, -0.06],
  orientation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
} as const;

//------------------------------------------------------------------------------
/**
 * Where the pinned panel sits relative to the viewer: 70 cm ahead — viewer space looks down `-z` —
 * and a little below eye level, which is where a menu is read without tipping the head back.
 */
const PINNED_OFFSET = {
  position: [0, -0.15, -0.7],
} as const;

//------------------------------------------------------------------------------
/**
 * The comfort vignette settings the panel offers, from none to most.
 *
 * Three rungs rather than a slider because there is nothing to aim a slider with in a headset, and
 * because the difference that matters is "off / a little / a lot".
 */
const COMFORT_LEVELS: readonly { label: string; strength: number }[] = [
  { label: "Off", strength: 0 },
  { label: "Low", strength: 0.4 },
  { label: "High", strength: 0.7 },
];

//------------------------------------------------------------------------------
/**
 * The one binding this app adds to the library's default map. `menu` is deliberately unbound by the
 * library, since no component means "menu" on every device, and the stick *click* is free on both
 * hands — the stick's axes drive locomotion, its button nothing. Left on both hands so there is one
 * fewer thing to remember. `gamepad: true` keeps a tracked hand, which has no stick at all, from
 * depending on a binding it can never raise: its way in is the wrist panel.
 */
const MENU_BINDING: LXRBinding = {
  action: "menu",
  gamepad: true,
  input: { component: "xr-standard-thumbstick" },
};

//------------------------------------------------------------------------------
/** The fields the per-frame refresh writes. Anything left out is not compared and not written. */
type ItemPatch = Partial<
  Pick<LXRPanelItem, "label" | "value" | "disabled" | "checked">
>;

//------------------------------------------------------------------------------
/**
 * The menu a headset session has instead of the React HUD.
 *
 * `dom-overlay` is an optional feature no headset browser grants, so nothing in the DOM is composited
 * into an immersive session — not the toolbar, not the settings sheet, not the virtual joysticks. This
 * is the same menu, drawn into the XR framebuffer through `XRLivelink.ui` and pointed at with a
 * controller. Everywhere else in the app that works around this refers back here.
 *
 * Two panels, carrying the same items, because pinning is about freeing the wrist rather than reaching
 * controls that are otherwise out of reach. One rides the left grip and is revealed by turning the
 * wrist over — a summon that needs no gesture recognition and behaves the same for a controller and a
 * tracked hand, being only the angle between the panel's normal and the viewer. The other is pinned in
 * front of the user and lazily follows the head, so the fiddly controls can be aimed at with both
 * hands free; it is raised by Pin, by Unpin, or by clicking a thumbstick.
 */
export class XRHeadsetUI {
  //--------------------------------------------------------------------------
  private readonly _webXRUtils: WebXRUtils;
  private readonly _wrist: LXRPanel;
  private readonly _pinned: LXRPanel;
  private readonly _panels: readonly LXRPanel[];
  private _unregisterFrameCallback?: () => void;

  //--------------------------------------------------------------------------
  /** Whether the pinned panel is up. See {@link isPinned}. */
  private _isPinned = false;

  //--------------------------------------------------------------------------
  /** Which rung of {@link COMFORT_LEVELS} the vignette is on. */
  private _comfortIndex: number;

  //--------------------------------------------------------------------------
  /**
   * @param webXRUtils The session glue this drives — every item below is wired to a method that
   * already existed for the DOM HUD.
   */
  constructor(webXRUtils: WebXRUtils) {
    this._webXRUtils = webXRUtils;
    const { livelinkXR } = webXRUtils;

    // The library defaults the vignette per session mode, so the panel starts on whatever rung
    // that landed on rather than on one of its own.
    this._comfortIndex = nearestComfortIndex(
      livelinkXR.comfort_vignette_strength,
    );

    // Assigned rather than pushed, so building this twice in one session would still leave one
    // menu binding. The action map keeps its bindings across sessions by design — they are
    // consumer configuration — but this object does not outlive its own.
    // Over this app's own map, which has no grip control (`controllerBindings`).
    livelinkXR.actions.bindings = [
      ...controllerBindings(LXR_DEFAULT_ACTION_MAP, livelinkXR.xr_mode),
      MENU_BINDING,
    ];

    this._wrist = this._createPanel({
      widthM: WRIST_WIDTH_M,
      zOrder: WRIST_Z_ORDER,
      attachment: { kind: "grip", handedness: "left", offset: WRIST_OFFSET },
    });
    this._pinned = this._createPanel({
      widthM: PINNED_WIDTH_M,
      zOrder: PINNED_Z_ORDER,
      attachment: { kind: "head", offset: PINNED_OFFSET, lazy_follow: true },
    });
    this._pinned.is_shown = false;
    this._panels = [this._wrist, this._pinned];

    // The `anchor` phase, for the same reason `useARPlacement` uses it: it runs after the
    // library's placement update, so the Place item's enabled state is this frame's answer
    // rather than the previous frame's, and before the overlay update, so the actions read here
    // are still the ones a pointer is about to claim from.
    this._unregisterFrameCallback = livelinkXR.addFrameCallback({
      phase: "anchor",
      callback: this._onXRFrame,
    });
  }

  //--------------------------------------------------------------------------
  release() {
    this._unregisterFrameCallback?.();
    this._unregisterFrameCallback = undefined;

    const { ui } = this._webXRUtils.livelinkXR;
    for (const panel of this._panels) {
      ui.remove(panel);
      panel.release();
    }
  }

  //--------------------------------------------------------------------------
  /**
   * Build one panel and register it with the overlay manager, which draws it, moves it onto
   * whatever it follows and lets a pointer press it.
   */
  private _createPanel({
    widthM,
    zOrder,
    attachment,
  }: {
    widthM: number;
    zOrder: number;
    attachment: LXRPanelAttachment;
  }): LXRPanel {
    const items = this._buildItems();
    const panel = new LXRPanel({
      width_px: PANEL_WIDTH_PX,
      // Computed from the items rather than guessed — see `PANEL_WIDTH_PX`.
      height_px: computeLXRPanelHeight({ items, title: PANEL_TITLE }),
      width_m: widthM,
      items,
      title: PANEL_TITLE,
      attachment,
      z_order: zOrder,
    });

    this._webXRUtils.livelinkXR.ui.add(panel);
    return panel;
  }

  //--------------------------------------------------------------------------
  /**
   * The menu, built fresh for each panel: the item objects carry per-item state the panel writes
   * into, so two panels cannot share one array.
   */
  private _buildItems(): LXRPanelItem[] {
    const { livelinkXR } = this._webXRUtils;

    const items: LXRPanelItem[] = [
      {
        id: ITEM_SCALE,
        kind: "stepper",
        label: "Scale",
        value: formatScale(livelinkXR.camera_rig.scale),
        row: 1,
        on_activate: ({ part }) => this._onScaleStep(part),
      },
      {
        id: ITEM_FIT,
        kind: "button",
        label: "Fit 1m³",
        disabled: false,
        row: 2,
        on_activate: () => this._onFit(),
      },
    ];

    // Hidden rather than dimmed where no hit test source could be created — the rule
    // `AnchorControls` follows in the DOM too, since a control that can never work explains
    // nothing. Decided here rather than per frame because removing a row would resize the canvas.
    if (livelinkXR.placement.is_available) {
      items.push({
        id: ITEM_PLACE,
        kind: "button",
        label: "Place",
        disabled: true,
        row: 2,
        on_activate: () => this._onPlace(),
      });
    }

    items.push(
      {
        id: ITEM_TURN,
        kind: "toggle",
        label: "Snap turn",
        checked: livelinkXR.locomotion.turn_mode === "snap",
        row: 3,
        on_activate: () => this._onTurnToggle(),
      },
      {
        id: ITEM_COMFORT,
        kind: "stepper",
        label: "Comfort",
        value: COMFORT_LEVELS[this._comfortIndex].label,
        row: 4,
        on_activate: ({ part }) => this._onComfortStep(part),
      },
      {
        id: ITEM_PIN,
        kind: "button",
        label: this._isPinned ? "Unpin" : "Pin",
        disabled: false,
        row: 5,
        on_activate: () => this._setPinned(!this._isPinned),
      },
      {
        id: ITEM_EXIT,
        kind: "button",
        label: "Exit",
        disabled: false,
        row: 5,
        on_activate: () => this._onExit(),
      },
      // The mini-toast line. Empty until a mini-toast is shown, and cleared again by the
      // store's own timeout — see `_refresh`.
      {
        id: ITEM_STATUS,
        kind: "label",
        label: "",
        row: 6,
      },
    );

    return items;
  }

  //--------------------------------------------------------------------------
  private _onXRFrame = () => {
    const { actions } = this._webXRUtils.livelinkXR;

    // The shortcut for the pinned panel, for a user who does not want to raise a wrist for it.
    // Nothing claims `menu`, so unlike the trigger it means the same thing on and off a panel.
    if (actions.getButton("menu").event === "down") {
      this._setPinned(!this._isPinned);
    }

    this._refresh();
  };

  //--------------------------------------------------------------------------
  /**
   * Bring every item up to date with what it reports on.
   *
   * Runs before the overlay update, so an item pressed this frame shows its result on the next one.
   * Running after would instead cost the Place item a frame against a hit test refreshed just before
   * it — and one frame at display rate is invisible either way.
   */
  private _refresh() {
    const { livelinkXR } = this._webXRUtils;
    const { placement } = livelinkXR;

    this._writeItem(ITEM_SCALE, {
      value: formatScale(livelinkXR.camera_rig.scale),
    });
    this._writeItem(ITEM_PLACE, { disabled: !placement.has_surface });
    this._writeItem(ITEM_TURN, {
      checked: livelinkXR.locomotion.turn_mode === "snap",
    });
    this._writeItem(ITEM_COMFORT, {
      value: COMFORT_LEVELS[this._comfortIndex].label,
    });
    this._writeItem(ITEM_PIN, { label: this._isPinned ? "Unpin" : "Pin" });

    // Read out of the app's mini-toast store rather than kept here, so that the headset shows
    // the same words the DOM HUD does and gets its three-second clear for free. A pull rather
    // than a subscription: this already runs every frame, and there is nothing to unsubscribe.
    this._writeItem(ITEM_STATUS, {
      label: useMiniToastStore.getState().message ?? "",
    });
  }

  //--------------------------------------------------------------------------
  /**
   * Write fields onto the same item of both panels, and only where one actually changed.
   *
   * `LXRPanel.updateItem` marks the artwork dirty unconditionally, and the artwork is a full
   * canvas redraw and a texture upload. Writing an unchanged value from a per-frame callback
   * would pay both, on both panels, ninety times a second.
   *
   * @param id The item to write to. An id no panel carries — `place` in a session with no hit
   * test — is silently skipped.
   * @param patch The fields to write.
   */
  private _writeItem(id: string, patch: ItemPatch) {
    for (const panel of this._panels) {
      const item = panel.getItem(id);
      if (!item || isItemUnchanged(item, patch)) {
        continue;
      }
      panel.updateItem(id, patch);
    }
  }

  //--------------------------------------------------------------------------
  private _setPinned(value: boolean) {
    this._isPinned = value;
    this._pinned.is_shown = value;
  }

  //--------------------------------------------------------------------------
  private _onScaleStep(part: LXRPanelItemPart) {
    // The stepper's two ends are separate targets, and its middle is neither: a press that
    // landed on the readout should do nothing rather than pick a direction for the user.
    if (part === "decrement") {
      showMiniToast(`Scale ${formatScale(this._webXRUtils.scaleDown())}`);
    } else if (part === "increment") {
      showMiniToast(`Scale ${formatScale(this._webXRUtils.scaleUp())}`);
    }
  }

  //--------------------------------------------------------------------------
  private _onFit() {
    showMiniToast(
      `Scale ${formatScale(this._webXRUtils.fitToOneCubicMeter())}`,
    );
  }

  //--------------------------------------------------------------------------
  private _onPlace() {
    // The same two strings the DOM place button shows, and the same race: the item is disabled
    // without a surface, so `false` means the hit test dropped between the draw and the press.
    const placed = this._webXRUtils.livelinkXR.placement.place();
    showMiniToast(placed ? "Model placed" : "No surface detected");
  }

  //--------------------------------------------------------------------------
  private _onTurnToggle() {
    const { locomotion } = this._webXRUtils.livelinkXR;
    const isSnap = locomotion.turn_mode !== "snap";
    locomotion.turn_mode = isSnap ? "snap" : "smooth";
    showMiniToast(isSnap ? "Snap turn" : "Smooth turn");
  }

  //--------------------------------------------------------------------------
  private _onComfortStep(part: LXRPanelItemPart) {
    const step = part === "decrement" ? -1 : part === "increment" ? 1 : 0;
    // Clamped rather than wrapped: a user stepping to the end of a three-rung ladder means the
    // end, and wrapping from "High" back to "Off" would remove the vignette by accident.
    const index = Math.min(
      COMFORT_LEVELS.length - 1,
      Math.max(0, this._comfortIndex + step),
    );
    if (index === this._comfortIndex) {
      return;
    }

    this._comfortIndex = index;
    const level = COMFORT_LEVELS[index];
    this._webXRUtils.livelinkXR.comfort_vignette_strength = level.strength;
    showMiniToast(`Comfort ${level.label.toLowerCase()}`);
  }

  //--------------------------------------------------------------------------
  private _onExit() {
    // The library only suppresses the session ends it causes itself, so this one reaches the
    // app's `onSessionEnd` and puts `xrMode` back to null — which is what lands the user in the
    // flat viewer. Nothing else is needed here.
    this._webXRUtils.livelinkXR.xr_session?.end();
  }
}

//------------------------------------------------------------------------------
/**
 * Say something to the user, through the store the DOM HUD already publishes to.
 *
 * One path for both: on a phone it raises the toast, and in a headset `_refresh` copies it onto the
 * status line of both panels.
 *
 * @param message What to show.
 */
function showMiniToast(message: string) {
  useMiniToastStore.getState().showMiniToast(message);
}

//------------------------------------------------------------------------------
/**
 * Whether an item already says what a patch would write, field by field.
 *
 * @param item The item as it stands.
 * @param patch The fields about to be written. Fields left out are not compared.
 */
function isItemUnchanged(item: LXRPanelItem, patch: ItemPatch): boolean {
  return (
    (patch.label === undefined || patch.label === item.label) &&
    (patch.value === undefined || patch.value === item.value) &&
    (patch.disabled === undefined || patch.disabled === item.disabled) &&
    (patch.checked === undefined || patch.checked === item.checked)
  );
}

//------------------------------------------------------------------------------
/**
 * The rung of {@link COMFORT_LEVELS} closest to a vignette strength, so that a strength set by the
 * library's own per-mode default — or by a consumer, or by a previous panel — is shown as one of
 * the three the panel can offer rather than as whichever rung happens to be first.
 *
 * @param strength The current vignette strength.
 */
function nearestComfortIndex(strength: number): number {
  let best = 0;
  for (let index = 1; index < COMFORT_LEVELS.length; index++) {
    if (
      Math.abs(COMFORT_LEVELS[index].strength - strength) <
      Math.abs(COMFORT_LEVELS[best].strength - strength)
    ) {
      best = index;
    }
  }
  return best;
}
