import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@3dverse/ui-lib";

/**
 * What one does with the camera and on the cell, at the bottom centre of the viewport, over the
 * modes' navbar (`bottom-navbar`) — where the camera's reset always stood: reset the camera, and in
 * Assistance pin a note or follow someone.
 *
 * Below `lg`, the bottom centre belongs to the modes' sheets: it docks on the right instead, in the
 * row the secondary toolbar takes on the left, over the navbar.
 *
 * Its width follows its entries with a transition, as they come and go from one mode to the next:
 * an `auto` width cannot be animated, so the entries' own width is measured and set.
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
  const content = useRef<HTMLDivElement>(null);
  // `null` until measured: `auto` the first time, so it does not grow in from nothing.
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
      {/* Clips the entries while it narrows; they keep their own width inside. */}
      <div
        className="h-full max-w-full overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={width === null ? undefined : { width }}
      >
        <div ref={content} className="flex items-center gap-0.5 h-full w-max">
          {children}
        </div>
      </div>
    </nav>
  );
}

/** A thin vertical line between groups of a toolbar's entries. */
export function ToolbarDivider() {
  return (
    <span aria-hidden className="h-full mx-0.5 border-l border-secondary/50" />
  );
}
