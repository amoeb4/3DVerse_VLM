import { cn } from "@3dverse/ui-lib";

type HeadingProps = {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

//------------------------------------------------------------------------------
/** A panel's own title. */
export function PanelTitle({ children, className, as = "h1" }: HeadingProps) {
  const Component = as;
  return (
    <Component className={cn("font-heading text-sm font-bold", className)}>
      {children}
    </Component>
  );
}

//------------------------------------------------------------------------------
/** The small uppercase title of a section inside a panel. */
export function SectionTitle({ children, className, as = "h2" }: HeadingProps) {
  const Component = as;
  return (
    <Component
      className={cn("text-3xs font-bold tracking-wider uppercase", className)}
    >
      {children}
    </Component>
  );
}

//------------------------------------------------------------------------------
/**
 * The title row of a panel or a section: the title (`PanelTitle`, `SectionTitle`) as `children`,
 * what goes at its end (a badge, a button) as `aside`. It carries its own padding, not the
 * section's, so a `className` border or background spans the full width. Pair it with `SectionBody`.
 */
export function SectionHeader({
  aside,
  className,
  children,
}: {
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-2",
        className,
      )}
    >
      {children}
      {aside}
    </header>
  );
}

//------------------------------------------------------------------------------
/** What a section holds, under its `SectionHeader`: the same side padding, a gap below. */
export function SectionBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-4 pb-3", className)}>{children}</div>;
}
