import type { RefObject } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import {
  BottomSheet,
  BottomSheetContent,
  Button,
  Popover,
  PopoverContent,
} from "@3dverse/ui-lib";

import { useMediaQuery } from "../hooks/useMediaQuery";

// Ported from 3dverse-mobile-viewer: a popover anchored to the Invite button on large screens,
// a bottom sheet on small ones.
export function QrCodeModal({
  guestLink,
  open,
  onClose,
  anchorRef,
}: {
  guestLink: string;
  open: boolean;
  onClose?: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const content = (
    <div className="flex flex-col items-center justify-center gap-6 lg:gap-4 h-full text-center p-4 py-8 lg:py-3">
      <QRCode size={256} value={guestLink} />
      <h1 className="text-primary">Scan to join the 3D session</h1>
      <Button
        size={isLargeScreen ? "sm" : "lg"}
        className="w-full max-w-68 lg:max-w-none"
        onClick={onClose}
      >
        Close
      </Button>
    </div>
  );

  if (isLargeScreen) {
    return (
      <Popover open={open} onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
        <PopoverContent data-theme="light" shadow="lg" anchor={anchorRef} className="bg-white">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <BottomSheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
      <BottomSheetContent data-theme="light" showOverlay={false} className="bg-white">
        {content}
      </BottomSheetContent>
    </BottomSheet>
  );
}
