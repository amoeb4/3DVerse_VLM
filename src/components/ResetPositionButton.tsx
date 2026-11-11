import { Button, cn, Icon } from "@3dverse/ui-lib";
import { Kbd } from "./common/Kbd";
import { SHORTCUTS } from "../shortcuts/shortcuts";

const SHOW_KBD_SHORTCUTS = false;

/**
 * Reset camera position (P). `overlay`: a button of its own over the 3D view; `toolbar`: an entry
 * of the bottom-right toolbar (`TertiaryToolbar`), an icon in place of its label below `sm`. Dimmed
 * while the camera is already there.
 */
export function ResetPositionButton({
  onReset,
  isAtDefaultPosition,
  disabled,
  variant = "overlay",
}: {
  onReset: () => void;
  isAtDefaultPosition: boolean;
  disabled?: boolean;
  variant?: "overlay" | "toolbar";
}) {
  const isToolbar = variant === "toolbar";
  return (
    <Button
      variant={isToolbar ? "ghost" : "overlay-outline"}
      size={isToolbar ? "sm" : "xs"}
      className={cn(
        isToolbar
          ? "gap-1.5"
          : "px-4 py-2 gap-2 before:opacity-100 before:backdrop-blur-xl",
        isAtDefaultPosition && "text-primary/50",
      )}
      round={!isToolbar}
      title={`Reset camera position (${SHORTCUTS.reset.toUpperCase()})`}
      aria-label="Reset camera position"
      onClick={onReset}
      disabled={disabled}
    >
      {isToolbar && (
        <Icon className="fas fa-arrows-to-dot text-2xs sm:hidden" />
      )}
      <p className={cn(isToolbar && "hidden sm:block")}>
        Reset camera{" "}
        <span className="underline underline-offset-2 decoration-current/40">
          p
        </span>
        osition
      </p>
      {SHOW_KBD_SHORTCUTS && (
        <Kbd className="hidden lg:inline-flex">
          {SHORTCUTS.reset.toUpperCase()}
        </Kbd>
      )}
    </Button>
  );
}
