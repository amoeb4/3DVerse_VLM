import type { ReactNode } from "react";
import { cn } from "@3dverse/ui-lib";

type IconSlashedProps = {
  children: ReactNode;
  /** Toggle the slash without changing the markup. */
  slashed?: boolean;
  className?: string;
  /** Slash stroke width. Uses em so it follows the icon's font-size. */
  thickness?: string;
  /** Transparent gap cut into the icon on each side of the slash. */
  gap?: string;
  /** Slash length before rotation. */
  length?: string;
};

/**
 * Draws a diagonal slash across any icon, like fa-eye-slash.
 * The icon is masked along the diagonal, so the gap is transparent and
 * works on any background. The slash uses currentColor.
 *
 * Set the font size (text-*) on IconSlashed, not on the child icon, so the
 * em-based slash matches the icon's size.
 */
export const IconSlashed = ({
  children,
  slashed = true,
  className,
  thickness = "0.09em",
  gap = "0.07em",
  length = "1.5em",
}: IconSlashedProps) => {
  const cut = `calc(${thickness} / 2 + ${gap})`;
  const mask = `linear-gradient(45deg, #000 calc(47% - ${cut}), transparent calc(47% - ${cut}), transparent calc(45% + ${cut}), #000 calc(45% + ${cut}))`;

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        slashed ? className : undefined,
      )}
    >
      <span
        className="inline-flex"
        style={slashed ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        {children}
      </span>
      {slashed && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 rounded-full bg-current"
          style={{
            width: length,
            height: thickness,
            transform: "translate(-50%, -50%) rotate(45deg)",
          }}
        />
      )}
    </span>
  );
};
