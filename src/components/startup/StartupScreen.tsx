import { useState } from "react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { StartupPanel } from "../StartupPanel";
import { MachineGallery } from "./MachineGallery";

type StartupView = "grid" | "list";

const STORAGE_KEY = "vlm.startupView";

// Per-viewer convenience: wrapped, since storage can be unavailable (private mode, blocked site data).
const readView = (): StartupView => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};
const writeView = (view: StartupView) => {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Not remembered, that's all.
  }
};

/**
 * Both startup pages — the machine tiles (default) and the original compact list — with a toggle
 * between them that is remembered for next time.
 */
export function StartupScreen() {
  const [view, setView] = useState<StartupView>(readView);

  const select = (next: StartupView) => {
    setView(next);
    writeView(next);
  };

  return (
    <div className="relative">
      <div
        role="group"
        aria-label="Startup page layout"
        className="fixed top-4 right-4 z-10 flex rounded-full border border-tertiary bg-ground/80 p-0.5 backdrop-blur-xl"
      >
        {(
          [
            { value: "grid", icon: "fas fa-grip", label: "Tiles" },
            { value: "list", icon: "fas fa-list", label: "List" },
          ] as const
        ).map(({ value, icon, label }) => (
          <Button
            key={value}
            variant="ghost"
            size="xs"
            round
            aria-pressed={view === value}
            onClick={() => select(value)}
            className={cn(
              view === value && "bg-accent/15 text-accent",
            )}
            title={label}
          >
            <Icon className={cn(icon, "text-3xs")} />
          </Button>
        ))}
      </div>

      {view === "grid" ? (
        <MachineGallery />
      ) : (
        <StartupPanel />
      )}
    </div>
  );
}
