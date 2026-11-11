import { cn, EmptyState, Icon } from "@3dverse/ui-lib";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import { ARIcon } from "./ARIcon";
import { useWebXRStore } from "../../xr/stores";
import type { XRImmersiveMode } from "../../xr/xrSupport";

const buttons: {
  mode: XRImmersiveMode;
  icon?: string;
  image?: React.ElementType;
  title: string;
  description: string;
}[] = [
  {
    mode: "immersive-ar",
    image: ARIcon,
    title: "Augmented Reality",
    description: "Place the model in your space.",
  },
  {
    mode: "immersive-vr",
    // The original's `fat fa-head-vr` is a Font Awesome Pro icon; this app has the free set.
    icon: "fas fa-vr-cardboard",
    title: "Virtual Reality",
    description: "Step into an immersive view.",
  },
];

/**
 * The one way into AR and VR on a small screen, ported from 3dverse-mobile-viewer's `XRPanel`: a
 * row for each mode the device can enter; while it is being asked, or when it can enter neither,
 * an empty state saying so. Laid out for the sheet it is shown in (`XRSheet`).
 */
export function XRPanel({
  onEnter,
}: {
  onEnter: (mode: XRImmersiveMode) => void;
}) {
  // Detected as the viewer mounts, not here: known by the time the sheet opens.
  const xrSupport = useWebXRStore((state) => state.xrSupport);
  const isPending = useWebXRStore((state) => state.isXRSupportPending);
  const isXrSupported =
    xrSupport["immersive-ar"].isSupported ||
    xrSupport["immersive-vr"].isSupported;

  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const isMobileLandscape =
    useMediaQuery("(orientation: landscape) and (max-height: 500px)") &&
    !isLargeScreen;

  if (isPending) {
    return (
      <EmptyState
        icon="fas fa-spinner fa-spin"
        title="Checking for XR…"
        description="Looking for AR or VR support on this device."
      />
    );
  }

  if (!isXrSupported) {
    return (
      <EmptyState
        variant="glow"
        icon="fas fa-video-slash"
        title="AR/VR not supported"
        description="This device or browser doesn't support Augmented Reality or Virtual Reality."
      />
    );
  }

  return (
    <div
      className={cn(
        "grow flex",
        isMobileLandscape ? "p-4 gap-2" : "flex-col p-1",
      )}
    >
      {buttons
        .filter((button) => xrSupport[button.mode].isSupported)
        .map((button) => (
          <button
            key={button.mode}
            type="button"
            onClick={() => onEnter(button.mode)}
            className={cn(
              "flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-neutral-0/5 active:bg-neutral-0/10 cursor-pointer",
              isMobileLandscape
                ? "p-3 h-full grow basis-0 flex-col items-start justify-between border border-primary/50 bg-linear-to-br from-primary/10 to-primary/1 **:data-[slot=icon]:scale-135 **:data-[slot=icon]:[background:transparent]"
                : "w-full p-1",
            )}
          >
            <div
              data-slot="icon"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-primary/5"
            >
              {button.icon && <Icon className={cn(button.icon, "text-xl")} />}
              {button.image && <button.image className="w-48 h-48" />}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium">{button.title}</span>
              <span className="text-3xs leading-tight text-tertiary">
                {xrSupport[button.mode].needsSafari
                  ? "Open this page in Safari to start AR."
                  : button.description}
              </span>
            </div>
          </button>
        ))}
    </div>
  );
}
