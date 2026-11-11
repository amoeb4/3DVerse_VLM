import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@3dverse/ui-lib";
import { HeadsetGateButton } from "../HeadsetGate";

/**
 * What one does with the camera and on the cell, at the bottom centre of the viewport, over the
 * modes' navbar (`bottom-navbar`) — where the camera's reset always stood: reset the camera, and in
 * Assistance pin a note or follow someone.
 *
 * Below `lg` it docks on the right instead, over the navbar, facing the button of the mode's sheet
 * on the left (`ModeSheet`).
 *
 * Its width follows its entries with a transition, as they come and go from one mode to the next:
 * an `auto` width cannot be animated, so the entries' own width is measured and set.
 *
 * In a headset, it carries the way back to AR over itself (`HeadsetGateButton`).
 */
export function TertiaryToolbar({
  children,
  "aria-label": ariaLabel,
  className,
}: {
  children: ReactNode;
  "aria-label"?: string;
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
        "absolute bottom-full w-min mb-3 z-50",
        "bottom-navbar left-1/2 -translate-x-1/2",
        "max-lg:bottom-navbar max-lg:right-2 max-lg:max-w-[calc(100%-1rem)]",
        "[&_button]:outline-none",
        "starting:opacity-0 starting:translate-y-8 transition-all duration-500",
        className,
      )}
    >
      <HeadsetGateButton className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2" />
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
    <span aria-hidden className="h-full mx-0.5 border-l border-secondary/60" />
  );
}
