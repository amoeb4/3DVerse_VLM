import type { ReactNode } from "react";

import { createStore } from "./createStore";
import type { WebXRUtils } from "./WebXRUtils";
import {
  UNSUPPORTED_XR_MODE,
  type XRImmersiveMode,
  type XRModeSupport,
} from "./xrSupport";

// The XR state, as 3dverse-mobile-viewer keeps it (apps/common/stores.ts): outside React, because
// the session's own objects (`WebXRUtils`, the in-headset panels) read and write it too.

//------------------------------------------------------------------------------
type WebXRState = {
  /** The running session's glue; `null` out of XR and while a session starts. */
  webXRUtils: WebXRUtils | null;
  setWebXRUtils: (webXRUtils: WebXRUtils | null) => void;
  /** Set optimistically by whoever asks for XR: the session starts on the strength of it. */
  xrMode: null | XRSessionMode;
  setXrMode: (mode: XRSessionMode | null) => void;
  // Probed once as the viewer mounts rather than inside the XR menu — see `useXRSupportDetection`.
  xrSupport: Record<XRImmersiveMode, XRModeSupport>;
  isXRSupportPending: boolean;
  setXRSupport: (xrSupport: Record<XRImmersiveMode, XRModeSupport>) => void;
};

export const useWebXRStore = createStore<WebXRState>((set) => ({
  webXRUtils: null,
  setWebXRUtils: (webXRUtils) => set({ webXRUtils }),
  xrMode: null,
  setXrMode: (xrMode) => set({ xrMode }),
  xrSupport: {
    "immersive-ar": UNSUPPORTED_XR_MODE,
    "immersive-vr": UNSUPPORTED_XR_MODE,
  },
  isXRSupportPending: true,
  setXRSupport: (xrSupport) => set({ xrSupport, isXRSupportPending: false }),
}));

//------------------------------------------------------------------------------
type XRSettingsState = {
  // Both default off, the handheld setting: on a phone they cost bandwidth for little comfort
  // gain, while in a headset the display fills the field of view and they earn it.
  hasOverscan: boolean;
  setHasOverscan: (value: boolean) => void;
  hasLatencyCompensation: boolean;
  setLatencyCompensation: (value: boolean) => void;
  // Mirror of the session's `enable_fake_alpha`, which the library owns: it turns it on for AR
  // sessions by itself, so this is only ever a copy of its value (`WebXRUtils`).
  hasFakeAlpha: boolean;
  setHasFakeAlpha: (value: boolean) => void;
  // Seeds the two render settings above from the device class, once, at start-up.
  applyXRDeviceDefaults: (isXRHeadset: boolean) => void;
  // Driven by the idle auto-hide (`useIdleControlsVisibility`); read by the XR controls, which
  // fade together.
  areControlsVisible: boolean;
  setAreControlsVisible: (value: boolean) => void;
};

export const useXRSettingsStore = createStore<XRSettingsState>((set) => ({
  hasOverscan: false,
  setHasOverscan: (hasOverscan) => set({ hasOverscan }),
  hasLatencyCompensation: false,
  setLatencyCompensation: (hasLatencyCompensation) =>
    set({ hasLatencyCompensation }),
  hasFakeAlpha: false,
  setHasFakeAlpha: (hasFakeAlpha) => set({ hasFakeAlpha }),
  applyXRDeviceDefaults: (isXRHeadset) =>
    set({ hasOverscan: isXRHeadset, hasLatencyCompensation: isXRHeadset }),
  areControlsVisible: true,
  setAreControlsVisible: (areControlsVisible) => set({ areControlsVisible }),
}));

//------------------------------------------------------------------------------
type MiniToastState = {
  message: string | null;
  // Key shown as a kbd hint alongside the message when the action was (or can be) triggered by a shortcut.
  shortcut: string | null;
  // Arbitrary node rendered before the message.
  icon: ReactNode | null;
  // Bumped on every showMiniToast call, including repeats of the same message, so consumers keyed
  // on it can retrigger even when the text is unchanged.
  nonce: number;
  showMiniToast: (message: string, shortcut?: string, icon?: ReactNode) => void;
  // Takes the line away before its time: what it said no longer holds.
  hideMiniToast: () => void;
};

let miniToastTimeoutId: ReturnType<typeof setTimeout> | undefined;
export const useMiniToastStore = createStore<MiniToastState>((set) => ({
  message: null,
  shortcut: null,
  icon: null,
  nonce: 0,
  showMiniToast: (message, shortcut, icon) => {
    clearTimeout(miniToastTimeoutId);
    set((state) => ({
      message,
      shortcut: shortcut ?? null,
      icon: icon ?? null,
      nonce: state.nonce + 1,
    }));
    miniToastTimeoutId = setTimeout(
      () =>
        set((state) => ({
          message: null,
          shortcut: null,
          icon: null,
          nonce: state.nonce + 1,
        })),
      3000,
    );
  },
  hideMiniToast: () => {
    clearTimeout(miniToastTimeoutId);
    set((state) => ({
      message: null,
      shortcut: null,
      icon: null,
      nonce: state.nonce + 1,
    }));
  },
}));
