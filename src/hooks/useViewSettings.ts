import { useCallback, useEffect, useState } from "react";

/**
 * What the 3D view shows, toggled from the toolbar's View menu and remembered on this device:
 * - drawn over the stream, in this browser only: the hologram HUD, the joint angles, the
 *   atmosphere, and the welding arc's glare and sparks at the torch (`WeldArc`);
 * - rendered by 3dverse for this viewer's camera only: the outlines and the floor grid
 *   (`cameraRenderSettings`).
 */
export type ViewSettings = {
  holo: boolean;
  jointAngles: boolean;
  atmosphere: boolean;
  outlines: boolean;
  grid: boolean;
  /**
   * The View menu's "Arc sparkles". It was `weldArc` (`LEGACY_KEYS`). Not `arcLight`, which was the
   * scene's light: a choice stored under that name means nothing here.
   */
  arcSparkles: boolean;
};

export type ViewSetting = keyof ViewSettings;

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  holo: false,
  jointAngles: false,
  atmosphere: false,
  outlines: true,
  grid: false,
  arcSparkles: true,
};

const STORAGE_KEY = "vlm.view";

/** Former names of a setting, so a choice stored before it was renamed is kept. */
const LEGACY_KEYS: Partial<Record<ViewSetting, string>> = {
  arcSparkles: "weldArc",
};

export function useViewSettings(): {
  view: ViewSettings;
  toggleView: (setting: ViewSetting) => void;
} {
  const [view, setView] = useState<ViewSettings>(readSettings);

  useEffect(() => {
    writeSettings(view);
  }, [view]);

  const toggleView = useCallback((setting: ViewSetting) => {
    setView((previous) => ({ ...previous, [setting]: !previous[setting] }));
  }, []);

  return { view, toggleView };
}

//------------------------------------------------------------------------------
/** What was picked last on this device, setting by setting; the defaults for the rest. */
function readSettings(): ViewSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const settings = { ...DEFAULT_VIEW_SETTINGS };
    for (const key of Object.keys(settings) as ViewSetting[]) {
      const value = stored?.[key] ?? stored?.[LEGACY_KEYS[key] ?? ""];
      if (typeof value === "boolean") {
        settings[key] = value;
      }
    }
    return settings;
  } catch {
    return { ...DEFAULT_VIEW_SETTINGS };
  }
}

function writeSettings(settings: ViewSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: the menu still works, it is just not remembered.
  }
}
