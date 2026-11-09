import type { ReactNode } from "react";
import { cn } from "@3dverse/ui-lib";

/**
 * A tab docked in the bottom-left corner of the viewport, its right edge slanted like the mode
 * navbar's (`MainNavbar`). Below `lg`, where the navbar spans the bottom, it stands over the navbar
 * instead. Whatever else stands at the bottom left goes above it: lift it with the `toolbar`
 * spacing (`bottom-toolbar`; `bottom-navbar-toolbar` below `lg`).
 */
export function SecondaryToolbar({
  children,
  "aria-label": ariaLabel,
  className,
}: {
  children: ReactNode;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        // Fixed rather than the original's `relative`: it is docked to the viewport's corner.
        "fixed z-50 left-0 bottom-0 max-lg:bottom-navbar h-9",
        "isolate flex items-center pl-1 pr-4 pointer-events-auto",
        // The surface is a skewed pseudo-element, so the slant follows however many entries
        // there are and the content itself stays upright. It overshoots to the left, where the
        // skew would otherwise open a gap against the viewport edge.
        "before:content-[''] before:absolute before:inset-y-0 before:-left-4 before:right-0 before:-z-10",
        "before:origin-bottom-left before:skew-x-[21.5deg] before:rounded-tr-lg",
        "before:bg-ground/65 before:border-t before:border-r before:border-secondary before:backdrop-blur-lg before:shadow-[8px_2px_14px_rgb(0_0_0/0.25)] light:before:shadow-[8px_2px_14px_rgb(0_0_0/0.05)]",
        // Off the bottom edge, below `lg`: closed underneath too.
        "max-lg:before:border-b max-lg:before:rounded-br-lg",
        "[&_button]:py-2.5! [&_button]:outline-none",
        "starting:opacity-0 starting:-translate-x-6 transition-all delay-120 duration-350 ease-in-out",
        className,
      )}
    >
      {children}
    </nav>
  );
}
