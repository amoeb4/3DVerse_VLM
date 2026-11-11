import { useCallback, useRef, useState } from "react";
import { Button, Icon, cn } from "@3dverse/ui-lib";

import { useCloseOnOutsidePress } from "./useCloseOnOutsidePress";

export type ScaleOption = { value: string; label: string };

/**
 * Single grouped scale control: decrease / current-scale dropdown / increase. The decrease and increase
 * buttons support press-and-hold for smooth scaling. From 3dverse-mobile-viewer.
 *
 * The dropdown is drawn in place, under its button, rather than portalled to `<body>` as a menu
 * would be: it then stands wherever the toolbar does, inside the WebXR dom-overlay root, whatever
 * that root is. Every popup of an XR control does this.
 */
export function ScaleControl({
  label,
  options,
  onSelect,
  onStepDown,
  onStepUp,
  onHoldStart,
  onHoldEnd,
}: {
  label: string;
  options: ScaleOption[];
  onSelect: (value: string) => void;
  onStepDown: () => void;
  onStepUp: () => void;
  onHoldStart: (direction: "up" | "down") => void;
  onHoldEnd: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useCloseOnOutsidePress(root, isOpen, close);

  return (
    <div
      ref={root}
      className="relative flex items-center border border-secondary rounded-full bg-black/40"
    >
      <Button
        aria-label="Select scale"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        variant="ghost"
        className="rounded-none min-w-14 gap-1.5"
        onClick={() => setIsOpen((open) => !open)}
      >
        {label}
        <Icon className="fas fa-caret-down" />
      </Button>
      {isOpen && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-2 min-w-28 rounded-lg bg-ground/50 backdrop-blur-lg border border-secondary p-1 text-xs"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-1 text-sm text-left outline-none select-none",
                "hover:bg-primary/10 focus-visible:bg-primary/10",
              )}
              onClick={() => {
                close();
                onSelect(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <Button
        aria-label="Decrease scale"
        variant="ghost"
        size="icon-md"
        round
        onClick={onStepDown}
        onPointerDown={() => onHoldStart("down")}
        onPointerUp={onHoldEnd}
        onPointerLeave={onHoldEnd}
      >
        <Icon className="fas fa-compress-alt" />
      </Button>
      <Button
        aria-label="Increase scale"
        variant="ghost"
        size="icon-md"
        round
        onClick={onStepUp}
        onPointerDown={() => onHoldStart("up")}
        onPointerUp={onHoldEnd}
        onPointerLeave={onHoldEnd}
      >
        <Icon className="fas fa-expand-alt" />
      </Button>
    </div>
  );
}
