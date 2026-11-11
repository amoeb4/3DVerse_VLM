import { useState, type ReactNode } from "react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetTrigger,
  cn,
  Icon,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@3dverse/ui-lib";

export type ModeSheetTab<T extends string> = {
  id: T;
  label: string;
  /** A Font Awesome icon class, without the `fas` prefix. */
  icon: string;
};

/**
 * Below `lg`, a mode's panels in one sheet (`BottomSheet`), which comes up from the bottom of the
 * screen and is swiped down or tapped out of: one button opens it, the open tab's panels are
 * inside, over the tabs. Closed at first: the 3D view comes first.
 *
 * The button is a pill at the bottom left, over the navbar, facing the tertiary toolbar on the
 * right; `inFlow`, it is laid out by its parent instead (Part, in its bottom stack).
 *
 * The panels are its direct children, shown flat, without their own frame: the sheet is the frame.
 * They are only mounted while it is open.
 */
export function ModeSheet<T extends string>({
  label,
  icon,
  tabs,
  tab,
  onTabChange,
  badge,
  inFlow = false,
  children,
}: {
  label: string;
  /** A Font Awesome icon class, without the `fas` prefix. */
  icon: string;
  tabs: readonly ModeSheetTab<T>[];
  tab: T;
  onTabChange: (tab: T) => void;
  /** A count on the button, for what waits inside; none at 0. */
  badge?: number;
  inFlow?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger
        title={`Show ${label}`}
        className={cn(
          "flex items-center gap-2 h-9 pl-3.5 pr-3 shrink-0 pointer-events-auto cursor-pointer",
          "text-2xs font-medium whitespace-nowrap",
          "rounded-full border border-secondary bg-ground/65 backdrop-blur-lg shadow-[0_2px_14px_rgb(0_0_0/0.25)] light:shadow-[0_2px_14px_rgb(0_0_0/0.06)]",
          "outline-none focus-visible:outline-2 focus-visible:outline-accent-300",
          "starting:opacity-0 starting:translate-y-8 transition-all duration-500",
          !inFlow && "fixed z-50 left-2 bottom-navbar",
        )}
      >
        <Icon className={cn("fas text-3xs text-secondary", icon)} />
        {label}
        {badge ? (
          <span className="px-1.5 rounded-full bg-warning/20 text-warning text-4xs font-bold tabular-nums">
            {badge}
          </span>
        ) : null}
        <Icon className="fas fa-chevron-up text-5xs text-secondary" />
      </BottomSheetTrigger>

      <BottomSheetContent
        showOverlay={false}
        className="px-0 pb-[env(safe-area-inset-bottom)] max-h-[80dvh] sm:max-w-xl"
      >
        <BottomSheetTitle className="shrink-0 px-4 pb-2">
          {label}
        </BottomSheetTitle>
        <div
          className={cn(
            "min-h-0 overflow-y-auto overscroll-contain scroll-fade-y",
            // The panels, flat: a line between them in place of each one's frame.
            "*:data-[slot=panel]:border-0 *:data-[slot=panel]:border-t *:data-[slot=panel]:border-tertiary",
            "*:data-[slot=panel]:rounded-none *:data-[slot=panel]:bg-transparent",
            "*:data-[slot=panel]:shadow-none *:data-[slot=panel]:backdrop-blur-none",
          )}
        >
          {children}
        </div>
        {tabs.length > 1 && (
          <Tabs
            value={tab}
            onValueChange={(value) => onTabChange(value as T)}
            className="shrink-0 px-5 py-3 bg-ground border-t border-tertiary overflow-x-auto scrollbar-none"
            data-base-ui-swipe-ignore
          >
            <TabsList
              variant="segment"
              size="sm"
              aria-label={label}
              className="w-full h-10!"
              swipeable
            >
              {tabs.map(({ id, label: tabLabel, icon: tabIcon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="grow gap-1.5 px-3 text-sm"
                >
                  <Icon className={cn("fas text-4xs", tabIcon)} />
                  {tabLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}
