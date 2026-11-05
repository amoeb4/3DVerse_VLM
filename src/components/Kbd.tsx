import { Kbd as KbdUI } from "@3dverse/ui-lib";
import { cn } from "@3dverse/ui-lib";

export const Kbd = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <KbdUI
      className={cn(
        "bg-overground/80 border-none px-1 py-0.5 min-w-0 text-[60%]",
        className,
      )}
    >
      {children}
    </KbdUI>
  );
};
