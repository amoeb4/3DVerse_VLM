import { cn } from "@3dverse/ui-lib";

export const PanelTitle = ({
  children,
  className,
  as = "h1",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}) => {
  const Component = as;
  return (
    <Component className={cn("font-heading text-sm font-bold", className)}>
      {children}
    </Component>
  );
};
