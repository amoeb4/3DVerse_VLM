import type { LXRBinding } from "@3dverse/livelink-webxr";

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
 * Applied as the session starts (`CameraControllerWebXR`), and again under the in-headset menu's
 * own binding (`XRHeadsetUI`). What the actions do (scale, speed, place) is `WebXRUtils`'s.
 * Applying it twice changes nothing.
 */
export function controllerBindings(
  bindings: readonly LXRBinding[],
  mode: XRSessionMode | null,
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
