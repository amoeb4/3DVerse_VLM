import type { ReactNode } from "react";
import { cn } from "@3dverse/ui-lib";

/**
 * A tab docked in the bottom-left corner of the viewport, its right edge slanted like the mode
 * navbar's (`MainNavbar`); `side="right"`, its mirror in the bottom-right corner (`XRSheet`). Below `lg` it holds the View button alone, and stands beside the navbar.
 * Whatever else stands at the bottom left goes above it: lift it with the `toolbar` spacing
 * (`bottom-toolbar`).
 */
export function SecondaryToolbar({
  children,
  side = "left",
  "aria-label": ariaLabel,
  className,
}: {
  children: ReactNode;
  /** The corner it is docked in; its slanted edge faces the navbar. */
  side?: "left" | "right";
  "aria-label"?: string;
  className?: string;
}) {
  const isLeft = side === "left";
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        // Fixed rather than the original's `relative`: it is docked to the viewport's corner.
        "fixed z-50 bottom-0 h-9",
        "isolate flex items-center pointer-events-auto",
        isLeft ? "left-0 pl-1 pr-4" : "right-0 pr-1 pl-4",
        // The surface is a skewed pseudo-element, so the slant follows however many entries
        // there are and the content itself stays upright. It overshoots towards the viewport
        // edge, where the skew would otherwise open a gap.
        "before:content-[''] before:absolute before:inset-y-0 before:-z-10",
        "before:bg-ground/65 before:border-t before:border-secondary before:backdrop-blur-lg",
        isLeft
          ? "before:-left-4 before:right-0 before:origin-bottom-left before:skew-x-[21.5deg] before:rounded-tr-lg before:border-r before:shadow-[8px_2px_14px_rgb(0_0_0/0.25)] light:before:shadow-[8px_2px_14px_rgb(0_0_0/0.05)]"
          : "before:-right-4 before:left-0 before:origin-bottom-right before:skew-x-[-21.5deg] before:rounded-tl-lg before:border-l before:shadow-[-8px_2px_14px_rgb(0_0_0/0.25)] light:before:shadow-[-8px_2px_14px_rgb(0_0_0/0.05)]",
        "[&_button]:py-2.5! [&_button]:outline-none",
        "transition-all delay-120 duration-350 ease-in-out starting:opacity-0",
        isLeft ? "starting:-translate-x-6" : "starting:translate-x-6",
        className,
      )}
    >
      {children}
    </nav>
  );
}
