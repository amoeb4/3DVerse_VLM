import { useContext, useEffect } from "react";
import {
  LXRScaleDown,
  LXRScaleUp,
  WebXRContext,
  type LXRBinding,
  type LXRButtonAction,
} from "@3dverse/livelink-webxr";

/** Each speed button press multiplies or divides the movement speed by this. */
const SPEED_STEP = 1.5;
const MIN_SPEED = 0.25;
const MAX_SPEED = 8;

const GRIP = "xr-standard-squeeze";
const TRIGGER = "xr-standard-trigger";

/**
 * The library's default bindings without any grip (`xr-standard-squeeze`) control, and in VR with
 * `sink` on the left trigger, where the grip had it.
 *
 * The Valve Index's grip is a force sensor: holding the controller normally reads as pressed, so
 * anything on it fires on its own (by default the viewer sinks through the floor). Rise is on the
 * right trigger, sink on the left one: both deliberate pulls. Not in AR, where the left trigger
 * places the content and sinking on it too would fight that.
 *
 * Applying it twice changes nothing.
 */
function controllerBindings(
  bindings: readonly LXRBinding[],
  mode: XRSessionMode,
): LXRBinding[] {
  const component = (binding: LXRBinding) =>
    "component" in binding.input ? binding.input.component : undefined;
  const isSinkOnLeftTrigger = (binding: LXRBinding) =>
    binding.action === "sink" &&
    component(binding) === TRIGGER &&
    binding.handedness === "left";

  const kept = bindings.filter(
    (binding) => component(binding) !== GRIP && !isSinkOnLeftTrigger(binding),
  );
  return mode === "immersive-vr"
    ? [
        ...kept,
        { action: "sink", handedness: "left", input: { component: TRIGGER } },
      ]
    : kept;
}

/**
 * The controller actions livelink.webxr binds but leaves to the app: scaling the world and changing
 * the movement speed. Moving (right stick, right trigger up, left trigger down — no grip, see
 * {@link controllerBindings}) and turning (left stick, snap turns in a headset) are applied by the
 * library itself.
 *
 * On `xr-standard` controllers (Valve Index, Quest, …), right hand:
 * - B grows the world, A shrinks it, around the viewer in VR and around its anchor in AR;
 * - with the thumb resting on the stick, B and A speed movement up and down instead.
 *
 * Render it inside `<WebXR>`, whose context it reads. Renders nothing.
 */
export function XRControllerActions({ mode }: { mode: XRSessionMode }): null {
  const { xrLivelink } = useContext(WebXRContext);

  useEffect(() => {
    if (!xrLivelink) {
      return;
    }
    // In AR the content is registered to the room: scale it in place, not around the viewer.
    const compensate_anchor_position = mode !== "immersive-ar";
    xrLivelink.actions.bindings = controllerBindings(
      xrLivelink.actions.bindings,
      mode,
    );

    return xrLivelink.addFrameCallback({
      callback: () => {
        const { actions, camera_rig, locomotion } = xrLivelink;
        const pressed = (action: LXRButtonAction) =>
          actions.getButton(action).event === "down";

        // What moves the viewer up and down, as it starts and stops: a button held without meaning
        // to (the Index's grip) shows up here.
        for (const action of ["rise", "sink"] as const) {
          const { event, value, source } = actions.getButton(action);
          if (event) {
            console.info(
              `[xr] ${action} ${event === "down" ? "on" : "off"}`,
              source
                ? `(${source.handedness} hand, value ${value.toFixed(2)})`
                : "",
            );
          }
        }

        try {
          if (pressed("scale-up")) {
            const scale = LXRScaleUp(camera_rig, {
              compensate_anchor_position,
            });
            console.info(`[xr] world scale ×${scale}`);
          } else if (pressed("scale-down")) {
            const scale = LXRScaleDown(camera_rig, {
              compensate_anchor_position,
            });
            console.info(`[xr] world scale ×${scale}`);
          }
        } catch (error) {
          // The rig is not built yet on the session's first frames.
          console.warn("[xr] cannot scale yet:", error);
        }

        if (pressed("speed-up") || pressed("speed-down")) {
          const factor = pressed("speed-up") ? SPEED_STEP : 1 / SPEED_STEP;
          locomotion.speed_scale = Math.min(
            MAX_SPEED,
            Math.max(MIN_SPEED, locomotion.speed_scale * factor),
          );
          console.info(
            `[xr] movement speed ×${locomotion.speed_scale.toFixed(2)}`,
          );
        }
      },
    });
  }, [xrLivelink, mode]);

  return null;
}
