import { Spinner } from "@3dverse/ui-lib";

import { useWebXRStore } from "./stores";

/**
 * Over the camera feed while an AR session starts: what to do meanwhile, for the device to find
 * the floor. From 3dverse-mobile-viewer.
 */
export function ARStartingOverlay() {
  const xrMode = useWebXRStore((state) => state.xrMode);
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);

  if (xrMode !== "immersive-ar" || webXRUtils !== null) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-10010 flex flex-col items-center justify-center gap-8 bg-black/60">
      <img
        src={`${import.meta.env.BASE_URL}images/ar-guide.svg`}
        alt=""
        aria-hidden="true"
        className="w-32 max-w-[60vw]"
      />
      <p className="text-lg font-medium text-white">
        Step backward and look around
      </p>
      <div className="flex items-center gap-3">
        <Spinner className="size-4 text-white/70" />
        <span className="text-sm text-white/70">Starting AR…</span>
      </div>
    </div>
  );
}
