import { useContext, useState } from "react";
import {
  CameraController,
  LivelinkContext,
  Viewport,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { SharedOverlayProvider } from "../holo/SharedOverlayProvider";
import { PartInCell } from "../part/PartInCell";
import type { PartMetric, Theme } from "../part/partColors";

const noHover = () => {};

/**
 * Monitor's second 3D viewpoint: the part as the Part mode shows it — the cell veiled, the part
 * coloured by `metric`, the camera turning around it — in a card bottom left, folding to its title
 * bar with the toggle right on it. A click on the view opens the Part mode (`onOpen`).
 *
 * A viewport of the 3D canvas: it must be rendered inside the `Canvas`, positioned over the screen
 * by `className` (the canvas covers the whole screen). The click opens nothing until the scene is
 * ready, as on the part in the main view (`PartInCell`). Its overlay is its own: the part and the
 * veil are drawn in it, not in the main view. The card's height is what Monitor's left column leaves
 * room for (`ALT_CAMERA_ROOM`, `altCameraLayout.ts`): keep the two in step.
 *
 * Without a build plate (`plateEuid`), the camera shows the cell as it is.
 */
export function AltCamera({
  cameraEntity,
  open,
  onToggle,
  onOpen,
  plateEuid,
  metric,
  theme,
  className,
}: {
  cameraEntity: Entity | null;
  open: boolean;
  onToggle: () => void;
  /** Opens the Part mode. */
  onOpen: () => void;
  plateEuid?: string;
  metric: PartMetric;
  theme: Theme;
  className?: string;
}) {
  // Its own controller: the part's orbit turns this view, not the main one.
  const [controller, setController] = useState<DefaultCameraController | null>(
    null,
  );
  // While Livelink connects (its loading panel up) or after it dropped, there is no part to open.
  const { isConnecting, isDisconnected } = useContext(LivelinkContext);
  const canOpen = !isConnecting && !isDisconnected;

  return (
    <section
      aria-label="Alternate camera"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-secondary",
        "shadow-[0_0_30px_rgba(0,0,0,0.1)] pointer-events-auto",
        "starting:opacity-0 starting:-translate-x-4 transition-all duration-500",
        className,
        open ? "rounded-b-none" : "",
      )}
    >
      <header className="flex items-center justify-between h-8 pl-3 pr-1 shrink-0 bg-ground/65 backdrop-blur-lg">
        <h2 className="flex items-center gap-1.5 text-3xs font-bold tracking-wider uppercase">
          <Icon className="fas fa-video text-4xs text-secondary" />
          Piece details
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-expanded={open}
          title={
            open ? "Fold the alternate camera" : "Show the alternate camera"
          }
          aria-label={
            open ? "Fold the alternate camera" : "Show the alternate camera"
          }
          onClick={onToggle}
        >
          <Icon
            className={cn(
              "fas fa-chevron-down text-5xs transition-transform duration-200",
              !open && "rotate-180",
            )}
          />
        </Button>
      </header>
      {open && (
        <div className="group relative aspect-video border-t border-tertiary">
          <Viewport cameraEntity={cameraEntity} className="size-full">
            <CameraController ref={(next) => setController(next ?? null)} />
            {plateEuid && (
              <SharedOverlayProvider>
                <PartInCell
                  plateEuid={plateEuid}
                  xray
                  metric={metric}
                  theme={theme}
                  shownLayer={Infinity}
                  focusLayer={null}
                  onHover={noHover}
                  cameraController={controller}
                  focusSignal={0}
                />
              </SharedOverlayProvider>
            )}
          </Viewport>
          {/* The whole view opens the Part mode: it takes the pointer, the camera turns by itself. */}
          <button
            type="button"
            onClick={onOpen}
            disabled={!canOpen}
            title={canOpen ? "Open the Part mode" : undefined}
            aria-label="Open the Part mode"
            className={cn(
              "absolute inset-0 grid place-items-center enabled:cursor-pointer",
              "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
            )}
          >
            {canOpen && (
              <span
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ground/80 backdrop-blur-sm text-3xs font-medium",
                  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200",
                )}
              >
                <Icon className="fas fa-cube text-4xs" />
                Open piece details
              </span>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
