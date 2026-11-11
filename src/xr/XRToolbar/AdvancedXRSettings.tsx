import { useCallback, useRef, useState } from "react";
import {
  Button,
  DataItem,
  DataItemDescription,
  DataItemLabel,
  DataItemTitle,
  DataItemValue,
  Icon,
  Tabs,
  TabsList,
  TabsTrigger,
  ToggleButton,
} from "@3dverse/ui-lib";

import {
  useMiniToastStore,
  useWebXRStore,
  useXRSettingsStore,
} from "../stores";
import { useCloseOnOutsidePress } from "./useCloseOnOutsidePress";

const ANCHOR_AABB_BOTTOM = "aabb-bottom";
const ANCHOR_WORLD_ORIGIN = "world-origin";

const SIZE = "xs";

/**
 * The XR rendering controls, plus the anchor-reference toggle, from 3dverse-mobile-viewer's
 * `AdvancedXRSettings`. None has an outcome a user can predict from an icon, and overscan and
 * latency compensation make the image worse when set wrong — so they are defaulted per device
 * (`applyXRDeviceDefaults`) and kept behind this button for the cases where a default is not right.
 *
 * There it is a disclosure at the bottom of the settings panel; this app has no such panel, so it
 * opens from the XR toolbar. Only rendered during a live session: every value here is read from,
 * and written to, that session's objects. The popup is drawn in place — see `ScaleControl`.
 */
export function AdvancedXRSettings() {
  const webXRUtils = useWebXRStore((state) => state.webXRUtils);
  const hasOverscan = useXRSettingsStore((state) => state.hasOverscan);
  const setHasOverscan = useXRSettingsStore((state) => state.setHasOverscan);
  const hasLatencyCompensation = useXRSettingsStore(
    (state) => state.hasLatencyCompensation,
  );
  const setLatencyCompensation = useXRSettingsStore(
    (state) => state.setLatencyCompensation,
  );
  const hasFakeAlpha = useXRSettingsStore((state) => state.hasFakeAlpha);

  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useCloseOnOutsidePress(root, isOpen, close);

  if (!webXRUtils) {
    return null;
  }

  const isAR = webXRUtils.livelinkXR.xr_mode === "immersive-ar";

  // Fake alpha lives on the XR session; the store only mirrors it (`WebXRUtils.setFakeAlpha`).
  const toggleFakeAlpha = () => {
    // Read back out of the store rather than written through the hook's value: `webXRUtils` is a
    // mutable session object, not React state.
    const utils = useWebXRStore.getState().webXRUtils;
    if (!utils) {
      return;
    }
    const next = !utils.livelinkXR.enable_fake_alpha;
    utils.setFakeAlpha(next);
    useMiniToastStore
      .getState()
      .showMiniToast(next ? "Model fades into the room" : "Model drawn opaque");
  };

  return (
    <div ref={root} className="relative">
      <Button
        aria-label="Advanced XR settings"
        aria-expanded={isOpen}
        variant="ghost"
        size="icon-lg"
        round
        className="border border-secondary bg-black/40"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon className="fas fa-sliders" />
      </Button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-secondary bg-ground/50 backdrop-blur-lg py-1">
          <p className="px-3 py-1.5 text-4xs text-tertiary">Advanced</p>
          {isAR && (
            <DataItem size={SIZE}>
              <DataItemLabel icon="fas fa-ghost">
                <div>
                  <DataItemTitle>Transparency</DataItemTitle>
                  <DataItemDescription>
                    Fades the model into the room instead of hiding it
                  </DataItemDescription>
                </div>
              </DataItemLabel>
              <DataItemValue>
                <ToggleButton
                  isOn={hasFakeAlpha}
                  onToggle={toggleFakeAlpha}
                  size={SIZE}
                />
              </DataItemValue>
            </DataItem>
          )}
          <DataItem size={SIZE}>
            {/* The original's `fa-signal-stream` is a Font Awesome Pro icon. */}
            <DataItemLabel icon="fas fa-wave-square">
              <div>
                <DataItemTitle>Smooth latency</DataItemTitle>
                <DataItemDescription>
                  Follows your head between streamed frames
                </DataItemDescription>
              </div>
            </DataItemLabel>
            <DataItemValue>
              <ToggleButton
                isOn={hasLatencyCompensation}
                onToggle={() => setLatencyCompensation(!hasLatencyCompensation)}
                size={SIZE}
              />
            </DataItemValue>
          </DataItem>
          <DataItem size={SIZE}>
            {/* The original's `fa-object-intersect` is a Font Awesome Pro icon. */}
            <DataItemLabel icon="fas fa-maximize">
              <div>
                <DataItemTitle>Overscan</DataItemTitle>
                <DataItemDescription>
                  {/* Costs roughly twice the streamed pixels, which is why it is not on everywhere. */}
                  Renders wider so fast moves keep their edges
                </DataItemDescription>
              </div>
            </DataItemLabel>
            <DataItemValue>
              <ToggleButton
                isOn={hasOverscan}
                onToggle={() => setHasOverscan(!hasOverscan)}
                size={SIZE}
                // The library ignores overscan without latency compensation — there is no
                // billboard to widen — so it must not read as enabled either.
                disabled={!hasLatencyCompensation}
              />
            </DataItemValue>
          </DataItem>
          {isAR && <AnchorReference />}
        </div>
      )}
    </div>
  );
}

/** What lands on the surface when the model is placed: its base, or the scene's origin. */
function AnchorReference() {
  // The session's object is the source of truth and this mounts fresh every time the popup is
  // opened, so there is no copy of this to keep in sync anywhere else.
  const [anchorAabbBottom, setAnchorAabbBottom] = useState(
    () => useWebXRStore.getState().webXRUtils?.anchorAabbBottom ?? true,
  );

  const handleAnchorReferenceChange = (value: string) => {
    const utils = useWebXRStore.getState().webXRUtils;
    if (!utils) {
      return;
    }
    const aabbBottom = value === ANCHOR_AABB_BOTTOM;
    setAnchorAabbBottom(aabbBottom);
    // Moves what is already placed as well as what will be: the setter pushes the offset to the
    // library's placement and recomputes the anchor position from it.
    utils.anchorAabbBottom = aabbBottom;
    useMiniToastStore
      .getState()
      .showMiniToast(
        aabbBottom ? "Anchoring the model base" : "Anchoring the world origin",
      );
  };

  return (
    <DataItem size={SIZE} className="pr-0 flex flex-col items-start gap-0 pb-2">
      <DataItemLabel icon="fas fa-anchor">
        <div>
          <DataItemTitle>Anchor point</DataItemTitle>
          <DataItemDescription>What lands on the surface</DataItemDescription>
        </div>
      </DataItemLabel>
      <DataItemValue className="self-end">
        <Tabs
          onValueChange={handleAnchorReferenceChange}
          value={anchorAabbBottom ? ANCHOR_AABB_BOTTOM : ANCHOR_WORLD_ORIGIN}
        >
          <TabsList size={SIZE}>
            <TabsTrigger value={ANCHOR_AABB_BOTTOM}>Model base</TabsTrigger>
            <TabsTrigger value={ANCHOR_WORLD_ORIGIN}>World origin</TabsTrigger>
          </TabsList>
        </Tabs>
      </DataItemValue>
    </DataItem>
  );
}
