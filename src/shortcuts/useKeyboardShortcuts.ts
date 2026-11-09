import { useEffect } from "react";

import { MODES, VIEW_MODES, type ViewMode } from "../modes/modes";
import { isTypingInField } from "./isTypingInField";
import { MODE_SHORTCUTS, SHORTCUTS } from "./shortcuts";

export function useKeyboardShortcuts({
  onReset,
  onToggleControlPanel,
  onToggleSupervision,
  onClosePanel,
  onToggleTheme,
  onSelectMode,
}: {
  onReset: () => void;
  onToggleControlPanel: () => void;
  onToggleSupervision: () => void;
  onClosePanel: () => void;
  onToggleTheme: () => void;
  onSelectMode: (mode: ViewMode) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape closes the panel even while a slider or input inside it has focus.
      if (
        event.key.toLowerCase() === SHORTCUTS.closePanel &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        onClosePanel();
        return;
      }

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
        case SHORTCUTS.controlPanel:
          onToggleControlPanel();
          break;
        case SHORTCUTS.supervision:
          onToggleSupervision();
          break;
        case SHORTCUTS.theme:
          onToggleTheme();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onReset,
    onToggleControlPanel,
    onToggleSupervision,
    onClosePanel,
    onToggleTheme,
    onSelectMode,
  ]);
}
