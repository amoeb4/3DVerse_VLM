import { useRef, useState } from "react";
import { cn } from "@3dverse/ui-lib";

import {
  useMiniToastStore,
  useWebXRStore,
  useXRSettingsStore,
} from "../stores";
import { formatScale } from "../utils";
import { WebXRUtils } from "../WebXRUtils";
import { GhostControl, MAX_GHOST_OPACITY_PERCENT } from "./GhostControl";
import { ScaleControl, type ScaleOption } from "./ScaleControl";

const SCALE_PRESETS: { value: number; label: string }[] = [
  { value: 1000, label: "1000:1" },
  { value: 100, label: "100:1" },
  { value: 10, label: "10:1" },
  { value: 1, label: "1:1" },
  { value: 0.1, label: "1:10" },
  { value: 0.01, label: "1:100" },
  { value: 0.001, label: "1:1000" },
];
const FIT_TO_CUBE_VALUE = "fit";

const SCALE_OPTIONS: ScaleOption[] = [
  ...SCALE_PRESETS.map(({ value, label }) => ({ value: String(value), label })),
  { value: FIT_TO_CUBE_VALUE, label: "Fit 1m³" },
];

/**
 * An XR session's own controls, on a screen that shows the DOM (a phone, a tablet): the scale of
 * the scene, and in AR its opacity over the room. From 3dverse-mobile-viewer; `className` places
 * it. A headset has the same in its own menu (`XRHeadsetUI`).
 */
export const XRToolbar = ({ className }: { className?: string }) => {
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);
  const areControlsVisible = useXRSettingsStore(
    (state) => state.areControlsVisible,
  );
  const showMiniToast = useMiniToastStore((state) => state.showMiniToast);

  const scaleHoldPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentScale, setCurrentScale] = useState<number>(
    () => webXRUtils?.livelinkXR.camera_rig.scale ?? 1,
  );
  const [ghostOpacityPercent, setGhostOpacityPercent] = useState<number>(
    MAX_GHOST_OPACITY_PERCENT,
  );
  // Only meaningful while the scene is composited over passthrough: the library turns fake alpha
  // on for AR sessions by itself.
  const [hasFakeAlpha, setHasFakeAlpha] = useState(false);
  const [prevWebXRUtils, setPrevWebXRUtils] = useState(webXRUtils);
  if (webXRUtils !== prevWebXRUtils) {
    setPrevWebXRUtils(webXRUtils);
    if (webXRUtils) {
      setCurrentScale(webXRUtils.livelinkXR.camera_rig.scale);
      setGhostOpacityPercent(
        Math.round(webXRUtils.livelinkXR.fake_alpha_scale * 100),
      );
      setHasFakeAlpha(webXRUtils.livelinkXR.enable_fake_alpha);
    }
  }

  if (!webXRUtils) {
    return null;
  }

  const onSelectScale = (value: string) => {
    if (value === FIT_TO_CUBE_VALUE) {
      const fittedScale = webXRUtils.fitToOneCubicMeter();
      showMiniToast(`Scaled to fit a 1m³ cube (${formatScale(fittedScale)})`);
      setCurrentScale(fittedScale);
      return;
    }
    const newScale = Number(value);
    webXRUtils.setScale(newScale);
    showMiniToast(`Scale set to ${formatScale(newScale)}`);
    setCurrentScale(newScale);
  };

  const onStepScale = (direction: "up" | "down") => {
    webXRUtils.stopScaleHold();
    const newScale =
      direction === "up" ? webXRUtils.scaleUp() : webXRUtils.scaleDown();
    showMiniToast(
      `Scale ${direction === "up" ? "increased" : "decreased"} to ${formatScale(newScale)}`,
    );
    setCurrentScale(newScale);
  };

  const onScaleHoldStart = (direction: "up" | "down") => {
    webXRUtils.startScaleHold(direction);
    scaleHoldPollRef.current = setInterval(() => {
      setCurrentScale(webXRUtils.livelinkXR.camera_rig.scale);
    }, WebXRUtils.SCALE_HOLD_INTERVAL_MS);
  };

  const onScaleHoldEnd = () => {
    webXRUtils.stopScaleHold();
    if (scaleHoldPollRef.current !== null) {
      clearInterval(scaleHoldPollRef.current);
      scaleHoldPollRef.current = null;
    }
    setCurrentScale(webXRUtils.livelinkXR.camera_rig.scale);
  };

  const onChangeGhostOpacity = (percent: number) => {
    // Out of the store, not off the render: it is a long-lived imperative object.
    const utils = useWebXRStore.getState().webXRUtils;
    if (!utils) {
      return;
    }
    setGhostOpacityPercent(percent);
    utils.livelinkXR.fake_alpha_scale = percent / 100;
  };

  // Fades with the other XR controls instead of snapping out of existence, and stops taking taps
  // while it is invisible — an unseen button over a live camera feed is worse here than anywhere
  // else.
  return (
    <div
      className={cn(
        "flex items-center gap-2 pointer-events-auto transition-opacity duration-150 ease-in-out",
        className,
      )}
      style={{
        opacity: areControlsVisible ? undefined : 0,
        pointerEvents: areControlsVisible ? undefined : "none",
      }}
    >
      <ScaleControl
        label={formatScale(currentScale)}
        options={SCALE_OPTIONS}
        onSelect={onSelectScale}
        onStepDown={() => onStepScale("down")}
        onStepUp={() => onStepScale("up")}
        onHoldStart={onScaleHoldStart}
        onHoldEnd={onScaleHoldEnd}
      />
      {hasFakeAlpha && (
        <GhostControl
          opacityPercent={ghostOpacityPercent}
          onChangeOpacityPercent={onChangeGhostOpacity}
        />
      )}
    </div>
  );
};
