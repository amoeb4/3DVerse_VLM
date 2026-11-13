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
    <section className="">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
        className="group flex justify-between items-center gap-1.5 w-full pl-4 pr-2 py-1 text-left cursor-pointer hover:bg-primary/5 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="-translate-x-1 flex items-center justify-between gap-2">
          <Icon
            className={cn(
              "fas fa-angle-right text-[9px] text-secondary group-hover:text-primary transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
          <h2 className="text-3xs font-bold tracking-wider uppercase truncate">
            {title}
          </h2>
        </div>
        {aside}
      </button>

      {isOpen && (
        <div id={contentId} className="px-4 pt-1 pb-2">
          {children}
        </div>
      )}
    </section>
  );
}
