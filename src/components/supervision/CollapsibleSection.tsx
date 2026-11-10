import { useId, useState, type ReactNode } from "react";
import { cn, Icon } from "@3dverse/ui-lib";

/**
 * A panel section folded by default: its title is the toggle, and `aside` (a badge, a status) stays
 * beside it, folded or not. `aside` sits next to the toggle rather than in it, so a button of its own
 * stays a button of its own. Its content is only rendered open, so what it polls stops while folded.
 */
export function CollapsibleSection({
  title,
  aside,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="px-4 py-1">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((open) => !open)}
          className="-translate-x-1 flex items-center gap-1.5 -ml-1 pl-1 pr-2 py-1 text-left rounded-md cursor-pointer hover:bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon
            className={cn(
              "fas fa-angle-right text-5xs text-secondary transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
          <h2 className="text-3xs font-bold tracking-wider uppercase">
            {title}
          </h2>
        </button>
        {aside}
      </div>
      {isOpen && (
        <div id={contentId} className="mt-1.5 mb-1">
          {children}
        </div>
      )}
    </section>
  );
}
