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
import { XRButton } from "../../webXR";

const noHover = () => {};

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
  onOpen: () => void;
  plateEuid?: string;
  metric: PartMetric;
  theme: Theme;
  className?: string;
}) {
  const [controller, setController] = useState<DefaultCameraController | null>(
    null,
  );
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

        <div className="flex items-center gap-1">
          {/* Entrées XR : seulement quand la carte est ouverte. They start the viewer's XR session
              (`Viewer` in `App.tsx`), not one of this card's own: a `<WebXR>` mounted here sits
              inside the main `<Canvas>`, which then stays mounted and is drawn over the headset's
              image, a floating frame in its top left. The part overlay of this card does not
              follow into the headset: livelink.webxr 0.8.4 cannot composite a viewport overlay
              into an XR frame. */}
          {open && canOpen && (
            <>
              <XRButton mode="immersive-ar" text="Start" />
              <XRButton mode="immersive-vr" text="Start" />
            </>
          )}
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
        </div>
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

          {/* Toute la vue ouvre le Part mode : elle prend le pointeur, la caméra tourne d'elle-même. */}
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
