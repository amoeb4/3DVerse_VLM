import { Button, cn, Icon, IslandBar } from "@3dverse/ui-lib";
import { Kbd } from "./common/Kbd";

import { InvitePanel } from "../invite/InvitePanel";
import { AskExpertButton } from "./assist/AskExpertButton";
import { SHORTCUTS } from "../shortcuts/shortcuts";
import { AvatarList } from "../invite/Avatars";
import type { DefaultCameraController } from "@3dverse/livelink-react";

const SHOW_KBD_SHORTCUTS = false;

/**
 * The viewer's top-right tools: the people (avatars, invite) and "Ask an expert", in every mode.
 * The View menu, with the theme, is in the secondary toolbar, bottom left, with VR and AR. `full`
 * adds the Sandbox's Control Panel and Supervision panels.
 */
export function Toolbar({
  variant = "full",
  onToggleControlPanel,
  onToggleSupervision,
  isSupervisionOpen,
  cameraController,
  onOpenAssistance,
}: {
  variant?: "full" | "minimal";
  onToggleControlPanel: () => void;
  onToggleSupervision: () => void;
  isSupervisionOpen: boolean;
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
      {/* The Sandbox's side panels. */}
      {variant === "full" && (
        <>
          <Button
            variant="overlay-outline"
            className="py-2 before:opacity-100 before:backdrop-blur-xl"
            title={`Control Panel (${SHORTCUTS.controlPanel.toUpperCase()})`}
            onClick={onToggleControlPanel}
          >
            <p className="hidden lg:block">
              <span className="underline underline-offset-2 decoration-current/40">
                C
              </span>
              ontrol Panel
            </p>
            <Icon className="fas fa-sliders text-2xs" />
            {SHOW_KBD_SHORTCUTS && (
              <Kbd className="hidden lg:inline-flex py-px">
                {SHORTCUTS.controlPanel.toUpperCase()}
              </Kbd>
            )}
          </Button>
          <Button
            variant="overlay-outline"
            className="py-2 before:opacity-100 before:backdrop-blur-xl"
            title={`Remote supervision (${SHORTCUTS.supervision.toUpperCase()})`}
            aria-pressed={isSupervisionOpen}
            onClick={onToggleSupervision}
          >
            <p>
              Super
              <span className="underline underline-offset-2 decoration-current/40">
                v
              </span>
              ision
            </p>
            <Icon className="fas fa-tower-broadcast text-2xs" />
            {SHOW_KBD_SHORTCUTS && (
              <Kbd className="hidden lg:inline-flex py-px">
                {SHORTCUTS.supervision.toUpperCase()}
              </Kbd>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
