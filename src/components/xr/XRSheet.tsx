import { useState } from "react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetTrigger,
  Button,
  Icon,
} from "@3dverse/ui-lib";

import { SecondaryToolbar } from "../common/SecondaryToolbar";
import { XRPanel } from "./XRPanel";
import { useXRSupport, type XRImmersiveMode } from "./useXRSupport";

/**
 * Below `lg`, the one way into AR and VR: an XR button docked in the bottom-right corner, facing
 * the View button on the left, which opens a sheet (`XRPanel`) to enter either, or saying that
 * this device can enter neither. Large screens keep their VR and AR buttons where they are.
 */
export function XRSheet({
  setXRMode,
}: {
  setXRMode: (mode: XRImmersiveMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // Asked here, not in the sheet: known by the time it opens.
  const { isPending, support } = useXRSupport();

  return (
    <BottomSheet open={isOpen} onOpenChange={setIsOpen}>
      <SecondaryToolbar side="right" aria-label="Extended reality">
        <BottomSheetTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              active={isOpen}
              title="XR: open in augmented or virtual reality"
              aria-label="Extended reality"
              className="pr-5"
            />
          }
        >
          XR
        </BottomSheetTrigger>
      </SecondaryToolbar>

      <BottomSheetContent showOverlay={false} className="sm:max-w-xl">
        <BottomSheetTitle className="mb-2">Extended reality</BottomSheetTitle>
        <XRPanel
          isPending={isPending}
          support={support}
          onEnter={(mode) => {
            setIsOpen(false);
            setXRMode(mode);
          }}
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}
