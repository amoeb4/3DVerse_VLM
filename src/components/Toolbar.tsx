import { Button, cn, Icon } from "@3dverse/ui-lib";

import { InvitePanel } from "../invite/InvitePanel";
import { AvatarList } from "../invite/Avatars";
import type { DefaultCameraController } from "@3dverse/livelink-react";

export function Toolbar({
  onToggleControlPanel,
  showDOM3D,
  setShowDOM3D,
  cameraController,
}: {
  onToggleControlPanel: () => void;
  showDOM3D: boolean;
  setShowDOM3D: (show: boolean) => void;
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
        onClick={onToggleControlPanel}
      >
        Control Panel
        <Icon className="fas fa-sliders text-2xs" />
      </Button>
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
    </div>
  );
}
