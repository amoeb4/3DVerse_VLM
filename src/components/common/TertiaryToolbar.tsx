import type { ReactNode } from "react";
import { cn } from "@3dverse/ui-lib";

/**
 * What one does with the camera and on the cell, at the bottom centre of the viewport, over the
 * modes' navbar (`bottom-navbar`) — where the camera's reset always stood: reset the camera, and in
 * Assistance pin a note or follow someone.
 *
 * Below `lg`, the bottom centre belongs to the modes' sheets: it docks on the right instead, in the
 * row the secondary toolbar takes on the left, over the navbar.
 */
export function TertiaryToolbar({
  children,
  "aria-label": ariaLabel,
  inFlow = false,
  className,
}: {
  children: ReactNode;
  "aria-label"?: string;
  /**
   * Laid out by its parent rather than fixed at the bottom centre: in Part, it stands in the bottom
   * stack, over the build's timeline (`PartChrome`).
   */
  inFlow?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-0.5 h-9 px-1 pointer-events-auto",
        "rounded-full border border-secondary bg-ground/65 backdrop-blur-lg shadow-[0_2px_14px_rgb(0_0_0/0.25)] light:shadow-[0_2px_14px_rgb(0_0_0/0.06)]",
        !inFlow && [
          "fixed z-50",
          "lg:bottom-navbar lg:left-1/2 lg:-translate-x-1/2",
          "max-lg:bottom-navbar max-lg:right-2 max-lg:max-w-[calc(100%-1rem)]",
        ],
        "[&_button]:outline-none",
        "starting:opacity-0 starting:translate-y-8 transition-all duration-500",
        className,
      )}
    >
      {children}
    </nav>
  );
}

/** A thin vertical line between groups of a toolbar's entries. */
export function ToolbarDivider() {
  return (
    <span aria-hidden className="h-full mx-0.5 border-l border-secondary/50" />
  );
}
