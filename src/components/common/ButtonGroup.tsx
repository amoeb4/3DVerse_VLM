import { cn } from "@3dverse/ui-lib";

export const ButtonGroup = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "flex *:-ml-px *:not-last:border-r-0 *:hover:border-r! *:hover:z-1 *:rounded-none *:first:rounded-l-xl *:last:rounded-r-xl pointer-events-auto",
        className,
      )}
    >
      {children}
    </div>
  );
};
