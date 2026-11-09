import { cn, Icon } from "@3dverse/ui-lib";

import { MODES } from "../../modes/modes";

/**
 * Over the part, in Monitor: a link-like label beside the pointer, saying that a click opens the
 * part in Part mode. It follows the pointer, so the click is on the part itself.
 */
export function PartPeek({
  x,
  y,
}: {
  /** Where the pointer is, in viewport pixels: the label sits beside it, inside the screen. */
  x: number;
  y: number;
}) {
  const width = 150;
  const left = x + 14 + width > window.innerWidth ? x - 14 - width : x + 14;
  const top = Math.min(Math.max(8, y + 14), window.innerHeight - 32);

  return (
    <div
      className="fixed z-50 pointer-events-none flex"
      style={{ left, top, width }}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium whitespace-nowrap",
          "bg-ground/80 backdrop-blur-xl border border-tertiary shadow-[0_4px_14px_rgb(0_0_0/0.2)]",
        )}
      >
        <Icon className={cn("fas text-4xs", MODES.part.icon)} />
        Open piece details
      </span>
    </div>
  );
}
