import { Button, cn, Icon } from "@3dverse/ui-lib";

export function Toolbar({
  onOpenControlPanel,
  showDOM3D,
  setShowDOM3D,
}: {
  onOpenControlPanel: () => void;
  showDOM3D: boolean;
  setShowDOM3D: (show: boolean) => void;
}) {
  return (
    <div className="absolute top-4 right-4 flex gap-1 z-50">
      <Button
        variant="overlay-outline"
        className="py-2 before:opacity-100 before:backdrop-blur-xl"
        onClick={onOpenControlPanel}
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
