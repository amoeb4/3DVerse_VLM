import { cn, IslandBar } from "@3dverse/ui-lib";

import { InvitePanel } from "../invite/InvitePanel";
import { AskExpertButton } from "./assist/AskExpertButton";
import { AvatarList } from "../invite/Avatars";
import type { DefaultCameraController } from "@3dverse/livelink-react";

/**
 * The viewer's top-right tools: the people (avatars, invite) and "Ask an expert", in every mode.
 * The View menu, with the theme, is in the secondary toolbar, bottom left, with VR and AR.
 */
export function Toolbar({
  cameraController,
  onOpenAssistance,
}: {
  cameraController: DefaultCameraController | null;
  /** To the Assistance mode, from "Ask an expert". */
  onOpenAssistance: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute top-4 right-4 flex gap-3 z-50",
        "starting:opacity-0 starting:-translate-y-4 transition-all duration-500",
      )}
    >
      <IslandBar className="flex items-center gap-2 p-0.5 border border-secondary [corner-shape:round]">
        <AvatarList cameraController={cameraController} />
        <InvitePanel />
      </IslandBar>
      <AskExpertButton onOpenAssistance={onOpenAssistance} />
    </div>
  );
}
