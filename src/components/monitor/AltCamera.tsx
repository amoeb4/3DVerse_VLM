import { useContext, useState } from "react";
import {
  CameraController,
  LivelinkContext,
  Viewport,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { cn, Icon } from "@3dverse/ui-lib";
import { SubTitleSection } from "../common/Section";
import { SharedOverlayProvider } from "../holo/SharedOverlayProvider";
import { PartInCell } from "../part/PartInCell";
import type { PartMetric, Theme } from "../part/partColors";
import { XRButton } from "../../webXR";
import { useWebXRStore } from "../../xr/stores";

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
  // Detected once for the viewer (`XRSupport`); false until it has answered.
  const isARSupported = useWebXRStore(
    (state) => state.xrSupport["immersive-ar"].isSupported,
  );
  const isVRSupported = useWebXRStore(
    (state) => state.xrSupport["immersive-vr"].isSupported,
  );

  const foldLabel = open
    ? "Fold the alternate camera"
    : "Show the alternate camera";

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
      {/* The whole header folds and unfolds the card: a button behind its content, which sits over
          it and lets the click through, except for the XR entries, which are buttons of their own
          (a button cannot hold a button). */}
      <header className="relative flex items-center justify-between h-8 pl-3 pr-1 shrink-0 bg-ground/65 backdrop-blur-lg">
        <button
          type="button"
          aria-expanded={open}
          aria-label={foldLabel}
          title={foldLabel}
          onClick={onToggle}
          className={cn(
            "absolute inset-0 cursor-pointer hover:bg-primary/5 transition-colors duration-200",
            "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
          )}
        />
        <SubTitleSection
          as="h2"
          className="relative flex items-center gap-1.5 pointer-events-none"
        >
          <Icon className="fas fa-video text-4xs text-secondary" />
          Piece details
        </SubTitleSection>

        <div className="relative flex items-center gap-1 pointer-events-none">
          {/* Entrées XR : seulement quand la carte est ouverte, and only the modes this device
              can enter: nothing where it cannot, nor until that is known. They start the viewer's XR session
              (`XRSession`, in `Viewer`), not one of this card's own: a `<WebXR>` mounted here sits
              inside the main `<Canvas>`, which then stays mounted and is drawn over the headset's
              image, a floating frame in its top left. The part overlay of this card does not
              follow into the headset: livelink.webxr 0.8.4 cannot composite a viewport overlay
              into an XR frame. */}
          {open && canOpen && (
            <div className="flex items-center gap-1 pointer-events-auto">
              {isARSupported && <XRButton mode="immersive-ar" text="Start" />}
              {isVRSupported && <XRButton mode="immersive-vr" text="Start" />}
            </div>
          )}
          <span className="size-6 grid place-items-center text-secondary">
            <Icon
              className={cn(
                "fas fa-chevron-down text-5xs transition-transform duration-200",
                !open && "rotate-180",
              )}
            />
          </span>
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
