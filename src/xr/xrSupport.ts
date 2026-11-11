import {
  LXRVariantLaunchLauncher,
  XRLivelink,
  type LXRLaunchState,
} from "@3dverse/livelink-webxr";

import { VARIANT_API_KEY, VARIANT_URL } from "../config";
import { SESSION_ID_PARAM } from "../routing";

// Which immersive modes this device can enter and how to enter them, from 3dverse-mobile-viewer's
// livelink/xrSupport.ts: natively, or on iOS through the Variant Launch Clip App.

export type XRImmersiveMode = "immersive-ar" | "immersive-vr";

export type XRModeSupport = {
  /** Whether the mode can be entered, either natively or through a Variant Launch relaunch. */
  isSupported: boolean;
  /** Whether entering requires relaunching the app inside the Variant Launch iOS Clip App. */
  isVlaunchRequired: boolean;
  /**
   * Whether that relaunch needs the user to be in Safari. App Clip cards render there and nowhere
   * else, so in iOS Chrome, Firefox or any in-app browser the launch URL loads as an ordinary page
   * and the tap reads as if it did nothing at all.
   */
  needsSafari: boolean;
};

export const UNSUPPORTED_XR_MODE: XRModeSupport = {
  isSupported: false,
  isVlaunchRequired: false,
  needsSafari: false,
};

const SUPPORTED_XR_MODE: XRModeSupport = {
  isSupported: true,
  isVlaunchRequired: false,
  needsSafari: false,
};

// The Variant Launch SDK dispatches `vlaunch-initialized` once it has probed the device. If it never
// does (blocked script, offline, SDK change) we must not hang detection forever, otherwise the
// deep-link auto-enter never fires and the XR button never appears.
const VLAUNCH_INIT_TIMEOUT_MS = 5000;

let arLauncher: LXRVariantLaunchLauncher | null = null;

/**
 * The Variant Launch adapter, built on first use. Built even with no key at all — `resolve` then
 * answers from the native check and reports `needs-launcher`, which is what "iOS WebXR is off"
 * should look like.
 */
function getARLauncher(): LXRVariantLaunchLauncher {
  // Loaded straight from the vendor, with the key in the URL.
  //
  // `redirect=true` is absent on purpose: it sends the device off to the Clip App as soon as the
  // SDK initializes, which happens while support is being *detected*. The relaunch belongs to
  // `enterXR`, on the user's tap.
  arLauncher ??= new LXRVariantLaunchLauncher({
    sdkKey: VARIANT_API_KEY,
    sdkUrl: `${VARIANT_URL}?key=${encodeURIComponent(VARIANT_API_KEY)}`,
  });
  return arLauncher;
}

function toModeSupport(state: LXRLaunchState): XRModeSupport {
  switch (state.status) {
    case "supported": {
      return SUPPORTED_XR_MODE;
    }
    case "launch-required": {
      // The device can do AR, but only from inside the Clip App, so the user has to be bounced
      // through `enterXR` below first.
      return {
        isSupported: true,
        isVlaunchRequired: true,
        needsSafari: state.needs_safari,
      };
    }
    default: {
      console.debug(
        `immersive-ar is unavailable (${state.reason}): ${state.message}`,
      );
      return UNSUPPORTED_XR_MODE;
    }
  }
}

async function detectARSupport(signal: AbortSignal): Promise<XRModeSupport> {
  // The launcher waits on the SDK handshake with no deadline of its own, so the timeout goes here.
  // An aborted wait resolves as unsupported rather than hanging, which is what keeps
  // `isXRSupportPending` from leaving the XR menu on its spinner for good.
  const state = await getARLauncher().resolve({
    mode: "immersive-ar",
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(VLAUNCH_INIT_TIMEOUT_MS),
    ]),
  });
  return toModeSupport(state);
}

async function detectVRSupport(): Promise<XRModeSupport> {
  // No launcher here: Variant Launch only brings WebXR AR to iOS, and asked about VR it would
  // answer `launch-required` all the same — a trip into a clip that cannot serve it.
  const isSupported = await XRLivelink.isSessionSupported("immersive-vr");
  console.debug(
    `immersive-vr is ${isSupported ? "" : "not "}natively supported.`,
  );
  return isSupported ? SUPPORTED_XR_MODE : UNSUPPORTED_XR_MODE;
}

/**
 * Probe every immersive mode once. Runs outside of any menu/sheet so the result is known
 * before the user opens anything, which is what the deep-link auto-enter and the XR button
 * visibility both depend on.
 */
export async function detectXRSupport(
  signal: AbortSignal,
): Promise<Record<XRImmersiveMode, XRModeSupport>> {
  if (!window.isSecureContext) {
    console.error("WebXR requires a secure context (https).");
    return {
      "immersive-ar": UNSUPPORTED_XR_MODE,
      "immersive-vr": UNSUPPORTED_XR_MODE,
    };
  }

  const [ar, vr] = await Promise.all([
    detectARSupport(signal),
    detectVRSupport(),
  ]);
  return { "immersive-ar": ar, "immersive-vr": vr };
}

/**
 * The address the Clip App should open.
 *
 * It reloads the app from scratch, with none of the state the current page has, so the session
 * has to survive in the address — as does the mode to enter, which `useAutoEnterXR` reads back on
 * the other side. The machine is the address's path already.
 */
function clipAppTargetUrl({
  mode,
  sessionId,
}: {
  mode: XRImmersiveMode;
  sessionId?: string;
}): string {
  const url = new URL(window.location.href);
  if (sessionId) {
    // Otherwise the relaunch could open another session on the same scene.
    url.searchParams.set(SESSION_ID_PARAM, sessionId);
  }
  url.searchParams.set("xr", mode);
  url.searchParams.set("vlaunchClipApp", "");
  return url.toString();
}

/**
 * Enter an immersive session, relaunching through the Variant Launch iOS Clip App when the
 * device requires it.
 *
 * This is the only place the app navigates to the Clip App: detection loads the SDK but never acts
 * on it, so the trip out of the browser only ever happens on a tap.
 */
export function enterXR({
  mode,
  isVlaunchRequired,
  setXrMode,
  sessionId,
}: {
  mode: XRImmersiveMode;
  isVlaunchRequired: boolean;
  setXrMode: (mode: XRImmersiveMode) => void;
  /** The session to come back to, through the Clip App. */
  sessionId?: string;
}): void {
  if (!isVlaunchRequired) {
    setXrMode(mode);
    return;
  }

  try {
    window.location.href = getARLauncher().getLaunchUrl(
      clipAppTargetUrl({ mode, sessionId }),
    );
  } catch (error) {
    console.error(
      "Variant Launch relaunch required but the SDK is not available.",
      error,
    );
  }
}

/**
 * Turn a failed XR session start into something worth showing the user.
 *
 * Entering XR is optimistic — the mode is set before the session exists — so a failure has to be
 * announced, otherwise the app silently drops back to the flat viewer and the tap reads as if it
 * did nothing at all.
 */
export function getEnterXRErrorMessage(error: unknown): string {
  const { name } = (error ?? {}) as { name?: string };

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permission to start the immersive session was refused.";
  }
  if (name === "NotSupportedError" || name === "InvalidStateError") {
    return "This device cannot start that immersive mode.";
  }
  return "Could not start the immersive session.";
}
