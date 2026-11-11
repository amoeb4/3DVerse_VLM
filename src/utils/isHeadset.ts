/**
 * Whether the page runs in a standalone XR headset's browser (Meta Quest, Pico, Wolvic), from the
 * user agent: WebXR support alone does not tell, phones and desktops with a tethered headset have
 * it too. Apple Vision Pro is not detected, its Safari reports itself as an iPad.
 *
 * `?headset=1` (or `0`) in the URL forces the answer, to try the layout on a desktop.
 */
const forced = new URLSearchParams(window.location.search).get("headset");

export const isHeadset =
  forced !== null
    ? forced !== "0" && forced !== "false"
    : /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent);

// For the stylesheet: the `headset:` Tailwind variant (`styles/index.css`).
if (isHeadset) {
  document.documentElement.dataset.headset = "";
}
