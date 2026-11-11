import { cn } from "@3dverse/ui-lib";

import { PeopleSection } from "../components/assist/PeopleSection";
import { RemoteActions } from "../components/monitor/RemoteActions";
import type { ViewMode } from "../modes/modes";

/**
 * Large screens, Monitor, Part and the Diagnostic: the actions on the right, the same panel from
 * one mode to the next; under them, the mode's own panel, portalled into the slot (`slotRef`).
 */
export function ViewerRightColumn({
  mode,
  onOpenAssistance,
  slotRef,
}: {
  mode: ViewMode;
  /** To the incident's recovery (`RemoteActions`). */
  onOpenAssistance: () => void;
  /** Given the slot's element, where the mode's chrome portals its own panel. */
  slotRef: (slot: HTMLDivElement | null) => void;
}) {
  const isPartMode = mode === "part";
  const isAssistMode = mode === "assistance";

  return (
    <div
      className={cn(
        "fixed right-4 top-28 z-40 w-80 xl:w-96 flex flex-col gap-3 pointer-events-none",
        // Part: above its timeline, which runs under this column on most screens.
        isPartMode
          ? "bottom-[calc(var(--spacing-navbar)+5.5rem)]"
          : "bottom-navbar xl:bottom-4",
        "starting:opacity-0 starting:translate-x-4 transition-all duration-500",
      )}
    >
      <RemoteActions
        onOpenAssistance={onOpenAssistance}
        inAssistance={isAssistMode}
        // Alone in the Diagnostic; over the mode's own panel elsewhere.
        className={cn(
          "overflow-y-auto",
          isAssistMode ? "min-h-0" : "shrink-0 max-h-[55%]",
        )}
      >
        {/* The Diagnostic: who is in the session, with the expert to ask for. */}
        {isAssistMode && <PeopleSection />}
      </RemoteActions>
      <div
        ref={slotRef}
        className="empty:hidden min-h-0 grow flex flex-col gap-3"
      />
    </div>
  );
}
