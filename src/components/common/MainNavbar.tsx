//------------------------------------------------------------------------------
import type { ReactNode } from "react";
import { cn, Icon } from "@3dverse/ui-lib";

//------------------------------------------------------------------------------
/**
 * A tab docked at the bottom centre of the viewport, both its edges slanted, as in the mobile
 * viewer. Holds `MainNavbarItem`s. Whatever else stands at the bottom centre goes above it: lift it
 * with the `navbar` spacing (`bottom-navbar`, `pb-navbar`…), its height and a gap.
 */
export const MainNavbar = ({
  children,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  "aria-label"?: string;
}) => {
  //--------------------------------------------------------------------------
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "relative isolate flex items-center gap-1 px-8 pointer-events-auto",
        "[&_button]:pt-4 [&_button]:pb-3",
        "starting:opacity-0 starting:translate-y-14 transition-all delay-120 duration-350 ease-in-out",
      )}
    >
      <SlantedHalf side="left" />
      <SlantedHalf side="right" />
      {children}
    </nav>
  );
};

//------------------------------------------------------------------------------
const SHOW_ICONS = false;

//------------------------------------------------------------------------------
/**
 * One of the navbar's entries: its icon over its label, the active one in the accent colour with a
 * glow under it.
 */
export function MainNavbarItem({
  icon,
  label,
  isActive = false,
  disabled = false,
  title,
  onClick,
  className,
}: {
  /** A Font Awesome icon class, without the `fas` prefix. */
  icon: string;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  className?: string;
}) {
  //--------------------------------------------------------------------------
  return (
    <button
      type="button"
      aria-pressed={isActive}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 px-2.5 sm:px-3 py-4! rounded-lg cursor-pointer",
        "text-4xs sm:text-3xs font-medium whitespace-nowrap transition-colors duration-200",
        "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-300",
        isActive
          ? "text-accent-300"
          : "text-secondary enabled:hover:text-primary",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 -bottom-2 h-3/4 -z-10 pointer-events-none",
          "bg-[radial-gradient(closest-side,var(--color-accent),transparent)] blur-md",
          "transition-opacity duration-300",
          isActive ? "opacity-70" : "opacity-0",
        )}
      />
      {SHOW_ICONS && <Icon className={cn("fas text-lg", icon)} />}
      <span>{label}</span>
    </button>
  );
}

//------------------------------------------------------------------------------
/** A thin vertical line between groups of the navbar's entries. */
export function MainNavbarDivider() {
  //--------------------------------------------------------------------------
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      className="self-stretch mx-1 border-l border-secondary/50"
    />
  );
}

//------------------------------------------------------------------------------
/**
 * Half of the navbar's surface. Skewing one surface slants both its edges the same way: each half is
 * a plate skewed its own way instead, cut square down the middle where the two meet — overlapping
 * there, their translucent fills would show a seam. The box cutting it reaches past the plate's outer
 * edge and top, so its shadow is not cut off with it.
 */
function SlantedHalf({ side }: { side: "left" | "right" }) {
  //--------------------------------------------------------------------------
  const isLeft = side === "left";

  //--------------------------------------------------------------------------
  return (
    <span
      aria-hidden
      className={cn(
        "absolute -top-6 bottom-0 -z-10 overflow-hidden pointer-events-none",
        isLeft ? "-left-8 right-1/2" : "left-1/2 -right-8",
      )}
    >
      <span
        className={cn(
          "absolute top-6 bottom-0",
          "bg-ground/65 border-t border-secondary backdrop-blur-lg",
          isLeft
            ? "left-8 -right-8 origin-bottom-left skew-x-[-21.5deg] rounded-tl-lg border-l shadow-[-8px_2px_14px_rgb(0_0_0/0.25)] light:shadow-[-8px_2px_14px_rgb(0_0_0/0.05)]"
            : "right-8 -left-8 origin-bottom-right skew-x-[21.5deg] rounded-tr-lg border-r shadow-[8px_2px_14px_rgb(0_0_0/0.25)] light:shadow-[8px_2px_14px_rgb(0_0_0/0.05)]",
        )}
      />
    </span>
  );
}
