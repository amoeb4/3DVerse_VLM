import { useEffect } from "react";

import { SHORTCUTS } from "./shortcuts";

function isTypingInField(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
}

export function useKeyboardShortcuts({
  onReset,
  onToggleControlPanel,
}: {
  onReset: () => void;
  onToggleControlPanel: () => void;
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

      switch (event.key.toLowerCase()) {
        case SHORTCUTS.reset:
          onReset();
          break;
        case SHORTCUTS.controlPanel:
          onToggleControlPanel();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onReset, onToggleControlPanel]);
}
