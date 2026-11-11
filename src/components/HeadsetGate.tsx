import { useContext, useEffect } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import { Button, Icon, cn } from "@3dverse/ui-lib";

import { XRButton } from "../webXR";
import { createStore } from "../xr/createStore";
import { useWebXRStore } from "../xr/stores";
import { ARIcon } from "../components/xr/ARIcon";

/**
 * Where the gate stands. Outside React, like the XR state it follows (`xr/stores.ts`): the gate
 * is mounted by the viewer, and the button that brings it back by a toolbar deep in its layout.
 */
type HeadsetGateState = {
  /** Sent away with "Dismiss": the page as it is on a desktop, until `open`. */
  isDismissed: boolean;
  /** A session was entered since the machine opened: "Re-enter" in place of "Enter". */
  hasEntered: boolean;
  open: () => void;
  dismiss: () => void;
  markEntered: () => void;
  reset: () => void;
};

const useHeadsetGateStore = createStore<HeadsetGateState>((set) => ({
  isDismissed: false,
  hasEntered: false,
  open: () => set({ isDismissed: false }),
  dismiss: () => set({ isDismissed: true }),
  // Back up when the session ends, even if it had been dismissed and XR entered from a button.
  markEntered: () => set({ hasEntered: true, isDismissed: false }),
  reset: () => set({ isDismissed: false, hasEntered: false }),
}));

/**
 * What a headset's browser shows over the viewer (`isHeadset`; the viewer mounts it only there):
 * one comes for the cell in one's room, not for a flat page, and a WebXR session only starts from
 * a tap. So one large "Enter AR", VR beside it, and a way on to the page as it is on a desktop.
 *
 * A bar at the bottom edge: the 3D view stays in sight above it, one sees what "Dismiss" leads to.
 * Shown again when the session ends, and from `HeadsetGateButton`.
 *
 * It follows the XR state rather than driving it: its buttons enter as every XR button does
 * (`XRButton`), and whichever way a session was entered, it is back once that session ends. Inside
 * the session nothing of the page shows in a headset: the way out is the session's own menu
 * (`XRHeadsetUI`), which is what its text points to.
 */
export function HeadsetGate({ machineName }: { machineName: string }) {
  const { isConnecting, isDisconnected } = useContext(LivelinkContext);
  const xrMode = useWebXRStore((state) => state.xrMode);
  const isDismissed = useHeadsetGateStore((state) => state.isDismissed);
  const hasEntered = useHeadsetGateStore((state) => state.hasEntered);
  const { dismiss, markEntered, reset } = useHeadsetGateStore.getState();

  // Each machine opens with its gate up, whatever the last one was left at.
  useEffect(() => reset, [reset]);
  // Once the session is up, not when it is asked for: one that fails to start was not entered.
  const isSessionUp = useWebXRStore((state) => state.webXRUtils !== null);
  useEffect(() => {
    if (isSessionUp) {
      markEntered();
    }
  }, [isSessionUp, markEntered]);

  // Before the connection there is nothing to enter; the loading panel says so itself.
  if (xrMode || isDismissed || isConnecting || isDisconnected) {
    return null;
  }

  const verb = hasEntered ? "Re-enter" : "Enter";

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`${verb} augmented reality`}
      className="fixed inset-0 z-9999 flex items-end justify-center pointer-events-auto bg-linear-to-t from-ground/60 to-transparent to-50%"
    >
      <div
        className={cn(
          "flex items-center gap-x-10 gap-y-6 w-full max-w-5xl pt-10 pb-20 px-6 md:pl-0 md:pr-16 max-md:flex-col max-md:text-center",
          "rounded-t-3xl border border-b-0 border-secondary bg-ground/65 backdrop-blur-lg shadow-[0_2px_14px_rgb(0_0_0/0.25)]",
          "starting:opacity-0 starting:translate-y-8 transition-all duration-500",
        )}
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-y-4 w-full">
          <ARIcon className="w-24 h-min md:w-90 md:h-40 opacity-50 fill-accent text-accent" />
          <div className="flex flex-col gap-1.5 grow text-pretty">
            <p className="text-sm font-bold tracking-wider uppercase text-secondary">
              {machineName}
            </p>
            <h1 className="text-3xl font-semibold">
              See the cell in your space
            </h1>
            <p className="mt-3 text-lg text-secondary">
              Inside, turn your left wrist over for the menu: scale, place, and
              exit.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 shrink-0">
          <XRButton
            mode="immersive-ar"
            text={verb}
            icon="fa-cube"
            className="w-full min-h-20 px-12 gap-3 text-2xl"
          />
          <div className="flex items-center gap-3">
            <XRButton
              mode="immersive-vr"
              text={verb}
              className="px-5 py-2.5 text-xl"
            />
            <Button
              variant="ghost"
              size="xl"
              className="px-5"
              onClick={dismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * In a headset, once on the page in 2D: brings the gate back. A large pill over the tertiary
 * toolbar (`TertiaryToolbar` places it), in every mode. Nothing out of a headset, where the gate
 * is not mounted and so never dismissed.
 */
export function HeadsetGateButton({ className }: { className?: string }) {
  const isDismissed = useHeadsetGateStore((state) => state.isDismissed);
  const xrMode = useWebXRStore((state) => state.xrMode);
  if (!isDismissed || xrMode) {
    return null;
  }
  return (
    <Button
      variant="overlay"
      size="xl"
      className={cn(
        "px-6 gap-2.5 rounded-full whitespace-nowrap bg-neutral-900/90",
        className,
      )}
      onClick={useHeadsetGateStore.getState().open}
    >
      <Icon className="fas fa-vr-cardboard text-base" />
      Open in AR / VR
    </Button>
  );
}
