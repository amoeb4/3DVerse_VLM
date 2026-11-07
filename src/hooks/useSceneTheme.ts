import { useCallback, useContext, useEffect } from "react";
import type { Livelink, SceneSettingsRecord, Vec3 } from "@3dverse/livelink";
import { LivelinkContext, useSceneSettings } from "@3dverse/livelink-react";

// Adapted from 3dverse-mobile-viewer's useSceneTheme, without its gradient editor and save.

export type SceneTheme = "light" | "dark";

type Environment = SceneSettingsRecord["environment"];
type Background = Pick<
  Environment,
  "ambientColorTop" | "ambientColorBottom" | "clearColor"
>;

/** The background per theme, at both ends of the spherical gradient and behind it. */
const THEME_COLORS: Record<SceneTheme, Vec3> = {
  light: [1, 1, 1],
  dark: [0, 0, 0],
};

/** What the scene opens in when it is in neither theme yet. The app was designed light. */
const DEFAULT_THEME: SceneTheme = "light";
const STORAGE_KEY = "vlm.theme";

/** Settings come back as floats. */
const COLOR_TOLERANCE = 0.001;

//------------------------------------------------------------------------------
/**
 * A light or dark scene: the spherical gradient's two ends (`environment.ambientColorTop` and
 * `ambientColorBottom`) and the clear colour behind them, all white or all black.
 *
 * Read from the scene settings on every render — `useSceneSettings` re-renders on each update — so
 * the theme is the scene's, not a copy kept here. `null` while the scene is in neither.
 *
 * Switching goes to the renderer only: everyone in the session sees the new background in the
 * stream, but it is not saved with the scene.
 */
export function useSceneTheme(): {
  theme: SceneTheme | null;
  setTheme: (theme: SceneTheme) => void;
  toggleTheme: () => void;
} {
  const { instance } = useContext(LivelinkContext);
  const { sceneSettings } = useSceneSettings();
  const environment = sceneSettings?.environment;
  const theme = environment ? themeOf(environment) : null;

  const setTheme = useCallback(
    (next: SceneTheme) => {
      if (!instance || !environment) {
        return;
      }
      propagate(instance, themeBackground(next));
      writePreference(next);
    },
    [instance, environment],
  );

  const toggleTheme = useCallback(
    () => setTheme((theme ?? readPreference()) === "light" ? "dark" : "light"),
    [theme, setTheme],
  );

  return { theme, setTheme, toggleTheme };
}

//------------------------------------------------------------------------------
/**
 * Keeps the page in the scene's theme. Mount once, inside `Livelink`.
 *
 * When the settings arrive and the scene is in neither theme, puts it in the one last picked on
 * this device (light the first time). A theme the scene is already in — another client switched
 * it — is kept. And sets `<html data-theme>`, which the design tokens are scoped by, so the
 * interface turns light or dark with the scene.
 */
export function useSceneThemeWatcher(): void {
  const { instance } = useContext(LivelinkContext);
  const { sceneSettings } = useSceneSettings();
  const environment = sceneSettings?.environment;
  const theme = environment ? themeOf(environment) : null;

  // Keyed on the settings object, which is the session's: its values change in place, so this
  // runs once per session.
  useEffect(() => {
    if (instance && environment && themeOf(environment) === null) {
      propagate(instance, themeBackground(readPreference()));
    }
  }, [instance, environment]);

  // Leaving the viewer puts the page back in the theme it had before, so Home looks the same
  // whether it is opened directly or come back to. Declared first, so it runs before the next one.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    return () => {
      if (previous === undefined) {
        delete root.dataset.theme;
      } else {
        root.dataset.theme = previous;
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme ?? readPreference();
  }, [theme]);
}

//------------------------------------------------------------------------------
function themeBackground(theme: SceneTheme): Background {
  const color = THEME_COLORS[theme];
  return {
    ambientColorTop: [...color],
    ambientColorBottom: [...color],
    clearColor: [...color],
  };
}

/**
 * The theme the background is in: all three colours have to match, as the engine's default — a
 * white gradient over a black clear colour — would otherwise pass for one.
 */
function themeOf(environment: Environment): SceneTheme | null {
  for (const theme of ["light", "dark"] as const) {
    const color = THEME_COLORS[theme];
    if (
      isColor(environment.ambientColorTop, color) &&
      isColor(environment.ambientColorBottom, color) &&
      isColor(environment.clearColor, color)
    ) {
      return theme;
    }
  }
  return null;
}

function isColor(color: readonly number[] | undefined, target: Vec3) {
  return (
    !!color &&
    target.every(
      (channel, index) =>
        Math.abs((color[index] ?? -1) - channel) <= COLOR_TOLERANCE,
    )
  );
}

function readPreference(): SceneTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function writePreference(theme: SceneTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the switch still works, it is just not remembered.
  }
}

//------------------------------------------------------------------------------
type EnvironmentUpdate = {
  updated_settings: { environment: Partial<Background> };
};

/**
 * Livelink internals a renderer-only settings write goes through: a write on the settings object is
 * also persisted with the scene, and there is no public way to ask for one without the other.
 */
type LivelinkInternals = {
  _core: {
    updateSceneSettings(
      params: EnvironmentUpdate & { persist: boolean },
    ): Promise<void>;
  };
  scene: {
    _settings: {
      _onSceneSettingsUpdated(
        event: EnvironmentUpdate & { emitter: null },
      ): void;
    };
  };
};

/**
 * Sends background colours to the renderer, not saved with the scene, and applies them to this
 * client's settings the way a server update is, so `useSceneSettings` re-renders.
 */
function propagate(instance: Livelink, background: Partial<Background>) {
  const { _core, scene } = instance as unknown as LivelinkInternals;
  const updated_settings = { environment: background };
  void _core.updateSceneSettings({ updated_settings, persist: false });
  scene._settings._onSceneSettingsUpdated({ updated_settings, emitter: null });
}
