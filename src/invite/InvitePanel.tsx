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
import { QrCodeModal } from "./QrCodeModal";

// URL params read by `App` to join the session directly, skipping the scene picker.
export const SESSION_ID_PARAM = "sessionId";
export const SCENE_ID_PARAM = "sceneId";

// Unlike the mobile viewer, this app connects with a public token, which cannot mint guest tokens
// (that needs `manage` scope). The invite link therefore names the session itself, and the guest
// joins it with the same public token.
const makeInviteLink = (sessionId: string, sceneId: string) => {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set(SESSION_ID_PARAM, sessionId);
  url.searchParams.set(SCENE_ID_PARAM, sceneId);
  return url.toString();
};

const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

export const InvitePanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [isTextCopied, setTextCopied] = useState(false);
  const { instance } = useContext(LivelinkContext);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const canShare = typeof navigator.share === "function";

  const sessionId = instance?.session.session_id;
  const sceneId = instance?.session.scene_id;
  const guestLink = useMemo(
    () => (sessionId && sceneId ? makeInviteLink(sessionId, sceneId) : ""),
    [sessionId, sceneId],
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
    {
      label: "QR code",
      onClick: () => setIsQrCodeModalOpen(true),
      icon: "fas fa-qrcode",
    },
  ];

  const triggerContent = (
    <>
      <Icon
        className={cn(
          "fas fa-user-plus text-2xs translate-x-px lg:translate-x-0",
          isTextCopied && "invisible",
        )}
      />
      <span className={cn("hidden lg:block", isTextCopied && "invisible")}>
        Invite
      </span>
      {isTextCopied && (
        <span className="absolute inset-0 bg-accent/60 rounded-full flex items-center justify-center gap-1.5 starting:scale-95 starting:opacity-0 transition-all duration-400 ease-out">
          <Icon
            className={cn(
              "fas fa-check text-white text-sm! lg:text-xs!",
              "starting:opacity-0 starting:translate-y-2 transition-all duration-400 ease-out",
            )}
          />
          <span
            className={cn(
              "hidden lg:block text-2xs font-medium",
              "starting:opacity-0 starting:translate-y-2 transition-all duration-300 delay-100 ease-out",
            )}
          >
            Copied
          </span>
        </span>
      )}
    </>
  );

  const triggerClassName = cn(
    "relative py-2 gap-2 before:opacity-100 before:backdrop-blur-xl outline-none",
    isTextCopied && "border-accent",
  );

  return (
    <>
      {!isLargeScreen ? (
        <Button
          ref={triggerRef}
          variant="overlay-outline"
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
                variant="overlay-outline"
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
