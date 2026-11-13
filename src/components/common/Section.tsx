import { cn } from "@3dverse/ui-lib";

type HeadingProps = {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

type SubTitleProps = Omit<HeadingProps, "as"> & {
  as?: HeadingProps["as"] | "span" | "p";
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
/**
 * The small uppercase label (`text-3xs font-bold tracking-wider uppercase`): a heading, or with
 * `as="span"` a label in a row of its own (a control's caption, a card's title).
 */
export function SubTitleSection({
  children,
  className,
  as = "h3",
}: SubTitleProps) {
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
/** The title of a section inside a panel: a `SubTitleSection` at heading level 2. */
export function SectionTitle({ children, className, as = "h2" }: HeadingProps) {
  return (
    <SubTitleSection as={as} className={className}>
      {children}
    </SubTitleSection>
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
