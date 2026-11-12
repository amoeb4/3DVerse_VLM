import { useEffect } from "react";
import type { RenderGraphDataObject } from "@3dverse/livelink";

import { createStore } from "../xr/createStore";

export type Theme = "light" | "dark";

/** What the viewer opens in the first time. The app was designed light. */
const DEFAULT_THEME: Theme = "light";
const STORAGE_KEY = "vlm.theme";

/**
 * This viewer's theme, light or dark: theirs alone, remembered on this device, and the same for
 * the interface (`useThemeOnPage`) and for the 3D view, whose background is this viewer's camera's
 * (`themeCameraSettings`). Nothing of it is the scene's: someone else in the session switching
 * theirs changes nothing here.
 *
 * Outside React, as the XR state is: a session's cameras are set up from it too (`WebXRUtils`).
 */
type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = createStore<ThemeState>((set, get) => ({
  theme: readPreference(),
  setTheme: (theme) => {
    set({ theme });
    writePreference(theme);
  },
  toggleTheme: () => get().setTheme(get().theme === "light" ? "dark" : "light"),
}));

/** This viewer's theme, and the switch to the other one. */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useThemeStore((state) => state.theme);
  return { theme, toggleTheme: useThemeStore.getState().toggleTheme };
}

/**
 * Keeps the page in this viewer's theme while the viewer is open: `<html data-theme>`, which the
 * design tokens are scoped by. Mount once.
 */
export function useThemeOnPage(): void {
  const theme = useThemeStore((state) => state.theme);

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
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}

/**
 * A theme in the 3D view, as settings of the render graph for a viewer's camera
 * (`camera.dataJSON`): light draws the scene's gradient, dark does not, which leaves the clear
 * colour behind it, black. The scene's colours are not touched: they are everyone's in the
 * session, a theme is one viewer's.
 */
export function themeCameraSettings(theme: Theme): RenderGraphDataObject {
  return { gradient: theme === "light" };
}

//------------------------------------------------------------------------------
function readPreference(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function writePreference(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the switch still works, it is just not remembered.
  }
}
