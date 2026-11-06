import { Button, cn } from "@3dverse/ui-lib";
import { Kbd } from "./common/Kbd";
import { SHORTCUTS } from "../shortcuts/shortcuts";

const SHOW_KBD_SHORTCUTS = false;

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
      variant="overlay-outline"
      className={cn(
        "px-4 py-2 gap-2 before:opacity-100 before:backdrop-blur-xl",
        isAtDefaultPosition && "text-primary/50",
      )}
      round
      title={`Reset position (${SHORTCUTS.reset.toUpperCase()})`}
      onClick={onReset}
      disabled={disabled}
    >
      <p>
        Reset{" "}
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
