// The XR options of the address, read once at page load (from 3dverse-mobile-viewer's
// utils/searchParams.ts).
const url = new URL(window.location.href);

/** The page runs inside the Variant Launch iOS Clip App, which is what brings WebXR AR to iOS. */
export const isVlaunchClipApp = url.searchParams.get("vlaunchClipApp") !== null;

/** `?xr=ar` or `?xr=vr`: the immersive mode to enter as soon as it can be (`useAutoEnterXR`). */
const xrSessionURLParam =
  url.searchParams.get("xrSession") || url.searchParams.get("xr") || "";
export const isARSessionURLParam = ["immersive-ar", "ar"].includes(
  xrSessionURLParam,
);
export const isVRSessionURLParam = ["immersive-vr", "vr"].includes(
  xrSessionURLParam,
);

// Forces the in-headset panels on in a session that *does* have a DOM overlay. The only way to
// exercise them without a headset: the Immersive Web Emulator provides two controllers with grip
// and target ray spaces, but the page it emulates them in still has its DOM composited.
export const xrHudForced = url.searchParams.get("xrHud") !== null;
