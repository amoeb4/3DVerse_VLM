import { Button, cn, Icon } from "@3dverse/ui-lib";
import { Kbd } from "./common";
import { SHORTCUTS } from "../shortcuts/shortcuts";
import { triggerHapticFeedback } from "../utils/haptics";

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
}: {
  onReset: () => void;
  isAtDefaultPosition: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn("gap-2", isAtDefaultPosition && "text-primary/50")}
      round
      title={`Reset camera position (${SHORTCUTS.reset.toUpperCase()})`}
      aria-label="Reset camera position"
      onClick={() => {
        triggerHapticFeedback();
        onReset();
      }}
      disabled={disabled}
    >
      <Icon className="fas fa-arrows-to-dot text-3xs sm:hidden" />

      <p className="hidden sm:block">
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
