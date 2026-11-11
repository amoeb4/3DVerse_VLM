import { useCallback, useRef, useState } from "react";
import { Button, Icon } from "@3dverse/ui-lib";

import { useCloseOnOutsidePress } from "./useCloseOnOutsidePress";

/**
 * The library takes this as `fake_alpha_scale` in [0, 1]. The slider bottoms out well above 0:
 * a fully invisible scene is indistinguishable from a broken app, and there is no affordance
 * left on screen to explain which one the user is looking at.
 */
export const MIN_GHOST_OPACITY_PERCENT = 20;
export const MAX_GHOST_OPACITY_PERCENT = 100;

/**
 * Opacity of the streamed scene over the AR passthrough, as a percentage. From
 * 3dverse-mobile-viewer.
 *
 * This is the one XR rendering control with an outcome a user can predict without knowing how the
 * pipeline works — drag it and the model fades into the room.
 *
 * The popup is drawn in place — see `ScaleControl`.
 */
export function GhostControl({
  opacityPercent,
  onChangeOpacityPercent,
}: {
  opacityPercent: number;
  onChangeOpacityPercent: (opacityPercent: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useCloseOnOutsidePress(root, isOpen, close);

  return (
    <div ref={root} className="relative">
      <Button
        aria-label="Scene transparency"
        aria-expanded={isOpen}
        variant="ghost"
        size="icon-lg"
        round
        className="border border-secondary bg-black/40"
        onClick={() => setIsOpen((open) => !open)}
      >
        {/* The original's `fal fa-ghost` is a Font Awesome Pro weight. */}
        <Icon className="fas fa-ghost" />
      </Button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-secondary bg-ground/50 backdrop-blur-lg px-4 py-3">
          <label className="flex items-baseline justify-between pb-2">
            <span className="text-xs text-secondary">Ghost</span>
            <span className="text-xs text-tertiary tabular-nums">
              {opacityPercent}%
            </span>
          </label>
          <input
            type="range"
            aria-label="Scene opacity"
            min={MIN_GHOST_OPACITY_PERCENT}
            max={MAX_GHOST_OPACITY_PERCENT}
            value={opacityPercent}
            onChange={(event) =>
              onChangeOpacityPercent(Number(event.target.value))
            }
            className="w-full h-5 accent-accent touch-none"
          />
        </div>
      )}
    </div>
  );
}
