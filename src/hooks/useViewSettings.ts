import { useCallback, useEffect, useState } from "react";

/**
 * What the 3D view shows, toggled from the toolbar's View menu and remembered on this device:
 * - drawn over the stream, in this browser only: the hologram HUD, the joint angles and the
 *   atmosphere;
 * - rendered by 3dverse for this viewer's camera only: the outlines and the floor grid
 *   (`cameraRenderSettings`);
 * - in the shared scene, for everyone: the arc's light.
 */
export type ViewSettings = {
  holo: boolean;
  jointAngles: boolean;
  atmosphere: boolean;
  outlines: boolean;
  grid: boolean;
  arcLight: boolean;
};

export type ViewSetting = keyof ViewSettings;

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  holo: false,
  jointAngles: false,
  atmosphere: false,
  outlines: true,
  grid: false,
  arcLight: true,
};

const STORAGE_KEY = "vlm.view";

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
      if (typeof stored?.[key] === "boolean") {
        settings[key] = stored[key];
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
