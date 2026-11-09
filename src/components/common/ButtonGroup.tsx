import { cn } from "@3dverse/ui-lib";

export const ButtonGroup = ({
  isAttached = false,
  className,
  children,
}: {
  isAttached?: boolean;
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <nav
      className={cn(
        "flex pointer-events-auto",
        isAttached
          ? "*:not-last:border-r-0! *:hover:z-1 *:rounded-none *:first:rounded-l-xl *:last:rounded-r-xl"
          : "gap-2",
        className,
      )}
    >
      {children}
    </nav>
  );
};
