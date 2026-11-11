import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import {
  Button,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  cn,
} from "@3dverse/ui-lib";

import { useMediaQuery } from "../hooks/useMediaQuery";
import { viewerPath } from "../routing";
import { DEFAULT_MODE, type ViewMode } from "../modes/modes";
import { useViewMode } from "../modes/useViewMode";
import { QrCodeModal } from "./QrCodeModal";

// Unlike the mobile viewer, this app connects with a public token, which cannot mint guest tokens
// (that needs `manage` scope). The invite link therefore names the session itself, and the guest
// joins it with the same public token: the machine's URL, e.g. /nj130-2.05?sessionId=….
// The guest opens in the inviter's mode (`&mode=training`), and is free to switch from there. From
// Assistance, where one invites the expert to help, the guest comes in as the expert (`&role=expert`).
const makeInviteLink = (sessionId: string, sceneId: string, mode: ViewMode) =>
  new URL(
    viewerPath(
      sceneId,
      sessionId,
      mode === DEFAULT_MODE ? undefined : mode,
      mode === "assistance" ? "expert" : undefined,
    ),
    location.origin,
  ).toString();

const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

export const InvitePanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [isTextCopied, setTextCopied] = useState(false);
  const { instance } = useContext(LivelinkContext);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const canShare = typeof navigator.share === "function";

  const { mode } = useViewMode();
  const sessionId = instance?.session.session_id;
  const sceneId = instance?.session.scene_id;
  const guestLink = useMemo(
    () =>
      sessionId && sceneId ? makeInviteLink(sessionId, sceneId, mode) : "",
    [sessionId, sceneId, mode],
  );

  const copyGuestLink = useCallback(() => {
    copyToClipboard(guestLink)
      .then(() => {
        setTextCopied(true);
        setTimeout(() => setTextCopied(false), 2000);
      })
      .catch((error) => console.error("Failed to copy invite link", error));
  }, [guestLink]);

  const shareGuestLink = useCallback(() => {
    if (!canShare) {
      copyGuestLink();
      return;
    }
    navigator
      .share({
        title: "Share the 3D session",
        // Keep text empty, else it gets copied as part of the shared url.
        text: "",
        url: guestLink,
      })
      .catch(() => {
        // The user dismissed the share sheet.
      });
  }, [guestLink, canShare, copyGuestLink]);

  const actions = [
    {
      label: "QR code",
      onClick: () => setIsQrCodeModalOpen(true),
      icon: "fas fa-qrcode",
    },
    { label: "Copy link", onClick: copyGuestLink, icon: "fas fa-link" },
    ...(canShare
      ? [
          {
            label: "Share link",
            onClick: shareGuestLink,
            icon: "fas fa-arrow-up-from-bracket",
          },
        ]
      : []),
  ];

  const triggerContent = (
    <>
      <Icon
        className={cn(
          "block lg:hidden! fas fa-user-plus text-2xs text-primary translate-x-px lg:translate-x-0",
          isTextCopied && "invisible",
        )}
      />
      <span
        className={cn(
          "hidden lg:block px-1 text-sm text-primary",
          isTextCopied && "invisible",
        )}
      >
        Share
      </span>
      {isTextCopied && (
        <span className="absolute inset-0 text-white bg-accent/80 rounded-full flex items-center justify-center gap-1.5 starting:scale-95 starting:opacity-0 transition-all duration-400 ease-out">
          <Icon
            className={cn(
              "fas fa-check text-sm lg:text-xs",
              "starting:opacity-0 starting:translate-y-2 transition-all duration-400 ease-out",
            )}
          />
          <span
            className={cn(
              "hidden text-2xs font-medium",
              "starting:opacity-0 starting:translate-y-2 transition-all duration-300 delay-50 ease-out",
            )}
          >
            Copied
          </span>
        </span>
      )}
    </>
  );

  const triggerClassName = cn(
    "relative px-2 py-1 h-full gap-2 outline-none",
    isTextCopied && "border-accent",
  );

  return (
    <>
      {!isLargeScreen ? (
        <Button
          ref={triggerRef}
          size="sm"
          variant="secondary"
          round
          className={triggerClassName}
          onClick={shareGuestLink}
          disabled={guestLink === ""}
        >
          {triggerContent}
        </Button>
      ) : (
        <Menu open={isOpen} onOpenChange={setIsOpen}>
          <MenuTrigger
            render={
              <Button
                ref={triggerRef}
                size="sm"
                variant="secondary"
                round
                className={triggerClassName}
                active={isOpen}
                disabled={guestLink === ""}
              />
            }
          >
            {triggerContent}
          </MenuTrigger>

          <MenuContent className="border border-tertiary">
            {actions.map(({ label, onClick, icon }) => (
              <MenuItem key={label} onClick={onClick}>
                <Icon className={icon} />
                {label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}

      <QrCodeModal
        guestLink={guestLink}
        open={isQrCodeModalOpen}
        onClose={() => setIsQrCodeModalOpen(false)}
        anchorRef={triggerRef}
      />
    </>
  );
};
