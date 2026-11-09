import { useEffect } from "react";

import { MODES, VIEW_MODES, type ViewMode } from "../modes/modes";
import { isTypingInField } from "./isTypingInField";
import { MODE_SHORTCUTS, SHORTCUTS } from "./shortcuts";

export function useKeyboardShortcuts({
  onReset,

  onToggleTheme,
  onSelectMode,
}: {
  onReset: () => void;

  onToggleTheme: () => void;
  onSelectMode: (mode: ViewMode) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat ||
        isTypingInField(event.target)
      ) {
        return;
      }

      const mode = VIEW_MODES.find(
        (candidate) => MODE_SHORTCUTS[candidate] === event.key,
      );
      if (mode) {
        if (MODES[mode].ready) {
          onSelectMode(mode);
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case SHORTCUTS.reset:
          onReset();
          break;
        case SHORTCUTS.theme:
          onToggleTheme();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onReset, onToggleTheme, onSelectMode]);
}
