import type { SceneTheme } from "../hooks/useSceneTheme";

/**
 * In the dark theme: a cold blue haze bleeding in from the top-left corner, as if from a light just
 * out of frame, a faint glow coming off the floor, and a vignette. Blended with `screen`, the haze
 * only ever brightens.
 */
const HAZE_DARK = [
  "radial-gradient(circle at 4% 6%, rgb(70 170 255 / 0.4), rgb(31 110 255 / 0.14) 24%, transparent 48%)",
  "radial-gradient(ellipse 55% 30% at 50% 100%, rgb(31 200 255 / 0.13), transparent 70%)",
].join(", ");
const VIGNETTE_DARK =
  "radial-gradient(ellipse at center, transparent 50%, rgb(0 4 14 / 0.6) 100%)";

/** In the light theme, a haze has nothing to brighten: a light, cool vignette only. */
const VIGNETTE_LIGHT =
  "radial-gradient(ellipse at center, transparent 60%, rgb(15 40 80 / 0.14) 100%)";

/**
 * The mood of a hologram render, laid over the whole 3D view, always: haze (the blue light), floor
 * glow and vignette. CSS only, so it costs nothing, and in this browser only. Must be rendered
 * inside the `Viewport`, before its other overlays so they stay crisp over it.
 *
 * Not the View menu's "Atmosphere", which is the render graph's (`cameraRenderSettings`).
 */
export function Haze({ theme }: { theme: SceneTheme }) {
  const isDark = theme === "dark";
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden starting:opacity-0 transition-opacity duration-700"
    >
      {isDark && (
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{ background: HAZE_DARK }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: isDark ? VIGNETTE_DARK : VIGNETTE_LIGHT }}
      />
    </div>
  );
}
