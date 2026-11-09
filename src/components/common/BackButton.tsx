import { Button, cn, Icon } from "@3dverse/ui-lib";

/**
 * Back to where a mode was opened from, on top of its left sidebar, the sidebar's full width: Part
 * back to the robot, Assistance back to monitoring. A clear, blurred glass bar with a thin light
 * border, its label on the left after the chevron.
 */
export function BackButton({
  label,
  title,
  onClick,
  className,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full h-[39px] gap-2.5 justify-start px-3 rounded-[9px]",
        "bg-transparent! text-neutral-0! border border-neutral-400 shadow-none! backdrop-blur-[31px]",
        "hover:bg-white/10! hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      title={title}
      onClick={onClick}
    >
      <Icon className="fas fa-angle-left text-2xs" />
      {label}
    </Button>
  );
}
