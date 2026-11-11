import type { Livelink } from "@3dverse/livelink";

// Resolves once every viewport has a camera. Polled because nothing notifies: in WebXR the viewports
// are only created on the first `XRFrame`, one per `XRView`, so there is no event to wait on. One
// shared promise, so concurrent callers wait on the same poll and it is cleared on resolve.
let waitForCameraPromise: Promise<void> | null = null;
export const waitForCameras = async (livelink: Livelink): Promise<void> => {
  if (waitForCameraPromise) {
    return waitForCameraPromise;
  }
  waitForCameraPromise = new Promise((resolve) => {
    const id = setInterval(() => {
      const { viewports } = livelink;
      if (
        viewports.length === 0 ||
        viewports.some((v) => !v.camera_projection?.camera_entity.camera)
      ) {
        return;
      }
      resolve();
      clearInterval(id);
      waitForCameraPromise = null;
    }, 300);
  });
  return waitForCameraPromise;
};

/**
 * The content scale as it is shown to the user, as a ratio against life size: `2:1` for a model
 * drawn twice as large, `1:50` for a building shrunk to a tabletop.
 *
 * The one formatter for the whole app — the DOM toolbar button, its toasts and the in-headset panel
 * all read from it, so the label and the message that announces it cannot disagree.
 */
export const formatScale = (scale: number): string => {
  const roundToTenth = (value: number) => Math.round(value * 10) / 10;
  return scale >= 1
    ? `${roundToTenth(scale)}:1`
    : `1:${roundToTenth(1 / scale)}`;
};

/** Whether this is an XR headset's browser (Quest, Magic Leap 2, HoloLens), from its client hints. */
export async function isRecognizedXrHeadset(): Promise<boolean> {
  const { userAgentData } = navigator as Navigator & {
    userAgentData?: {
      brands: { brand: string }[];
      platform: string;
      getHighEntropyValues: (
        hints: string[],
      ) => Promise<Record<string, unknown>>;
    };
  };
  if (!userAgentData) {
    return false;
  }
  const modelHints: unknown[] = userAgentData.brands.map((b) => b.brand);
  modelHints.push(userAgentData.platform);
  const data = await userAgentData.getHighEntropyValues([
    "model",
    "platform",
    "architecture",
    "uaFullVersion",
  ]);
  modelHints.push(...Object.values(data));

  return modelHints.some((hint) => {
    if (typeof hint !== "string") {
      return false;
    }
    // Lower case and `includes`, to anticipate changes of sec-ch-ua-model in those browsers.
    const lowered = hint.toLowerCase();
    return (
      lowered.includes("magic leap") ||
      lowered.includes("quest") ||
      lowered.includes("holographic")
    );
  });
}
