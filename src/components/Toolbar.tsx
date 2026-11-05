import { Button, cn, Icon } from "@3dverse/ui-lib";
import { Kbd } from "./Kbd";

import { InvitePanel } from "../invite/InvitePanel";
import { SHORTCUTS } from "../shortcuts/shortcuts";
import { AvatarList } from "../invite/Avatars";
import type { DefaultCameraController } from "@3dverse/livelink-react";
import type { SceneTheme } from "../hooks/useSceneTheme";
import { ButtonGroup } from "./common/ButtonGroup";

const SHOW_KBD_SHORTCUTS = false;

export function Toolbar({
  onToggleControlPanel,
  showDOM3D,
  setShowDOM3D,
  theme,
  onToggleTheme,
  cameraController,
}: {
  onToggleControlPanel: () => void;
  showDOM3D: boolean;
  setShowDOM3D: (show: boolean) => void;
  theme: SceneTheme | null;
  onToggleTheme: () => void;
  cameraController: DefaultCameraController | null;
}) {
  return (
    <div
      className={cn(
        "absolute top-4 right-4 flex gap-1 z-50",
        "starting:opacity-0 starting:-translate-y-4 transition-all duration-500",
      )}
    >
      <AvatarList cameraController={cameraController} />
      <InvitePanel />
      <Button
        variant="overlay-outline"
        className="py-2 before:opacity-100 before:backdrop-blur-xl"
        title={`Control Panel (${SHORTCUTS.controlPanel.toUpperCase()})`}
        onClick={onToggleControlPanel}
      >
        <p>
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
      <ButtonGroup>
        <Button
          variant="overlay-outline"
          className="py-2 before:opacity-100 before:backdrop-blur-xl"
          title={showDOM3D ? "Hide infos" : "Show infos"}
          onClick={() => setShowDOM3D(!showDOM3D)}
        >
          <Icon
            className={cn(
              "fas",
              showDOM3D ? "fa-eye" : "fa-eye-slash opacity-50",
            )}
          />
        </Button>
        <Button
          variant="overlay-outline"
          className="py-2 before:opacity-100 before:backdrop-blur-xl"
          title={`${theme === "dark" ? "Light" : "Dark"} theme (${SHORTCUTS.theme.toUpperCase()})`}
          onClick={onToggleTheme}
          disabled={!theme}
        >
          <Icon
            className={cn("fas", theme === "dark" ? "fa-sun" : "fa-moon")}
          />
        </Button>
      </ButtonGroup>
    </div>
  );
}
