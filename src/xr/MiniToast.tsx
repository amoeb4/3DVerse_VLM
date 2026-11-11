//------------------------------------------------------------------------------
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Kbd, cn } from "@3dverse/ui-lib";

//------------------------------------------------------------------------------
import { useMiniToastStore } from "./stores";

//------------------------------------------------------------------------------
/** A keyboard hint is no use where there is no keyboard. */
const hasKeyboard = () => !window.matchMedia("(pointer: coarse)").matches;

//------------------------------------------------------------------------------
type MiniToastEntry = {
  id: number;
  text: string;
  shortcut: string | null;
  icon: ReactNode | null;
  phase: "entering" | "visible" | "exiting";
};

//------------------------------------------------------------------------------
/**
 * A line of text confirming what was just done ("Model placed", "Scale 1:10"), sliding up over the
 * previous one: `useMiniToastStore.showMiniToast`. From 3dverse-mobile-viewer's `MiniToast`; its
 * dark halo only shows behind a message here, so it leaves no shadow on the page while idle.
 * `className` places it.
 */
export const MiniToast = ({ className }: { className?: string }) => {
  //--------------------------------------------------------------------------
  const toastMessage = useMiniToastStore((state) => state.message);
  const toastShortcut = useMiniToastStore((state) => state.shortcut);
  const toastIcon = useMiniToastStore((state) => state.icon);
  const toastNonce = useMiniToastStore((state) => state.nonce);

  //--------------------------------------------------------------------------
  // Each mini-toast message is tracked as its own entry so a new message can
  // slide up over the previous one instead of just swapping text in place.
  const toastIdRef = useRef(0);
  const [toastEntries, setToastEntries] = useState<MiniToastEntry[]>([]);

  //--------------------------------------------------------------------------
  useEffect(() => {
    setToastEntries((entries) => {
      const next: MiniToastEntry[] = entries.map((entry) => ({
        ...entry,
        phase: "exiting",
      }));
      if (toastMessage) {
        next.push({
          id: ++toastIdRef.current,
          text: toastMessage,
          shortcut: toastShortcut,
          icon: toastIcon,
          phase: "entering",
        });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on nonce so repeat messages retrigger
  }, [toastNonce]);

  //--------------------------------------------------------------------------
  useEffect(() => {
    if (!toastEntries.some((entry) => entry.phase === "entering")) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      setToastEntries((entries) =>
        entries.map((entry) =>
          entry.phase === "entering" ? { ...entry, phase: "visible" } : entry,
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [toastEntries]);

  //--------------------------------------------------------------------------
  useEffect(() => {
    const exitingIds = toastEntries
      .filter((entry) => entry.phase === "exiting")
      .map((entry) => entry.id);
    if (exitingIds.length === 0) {
      return;
    }
    const timeout = setTimeout(() => {
      setToastEntries((entries) =>
        entries.filter((entry) => !exitingIds.includes(entry.id)),
      );
    }, 300);
    return () => clearTimeout(timeout);
  }, [toastEntries]);

  //--------------------------------------------------------------------------
  return (
    <div
      className={cn(
        "relative w-full h-9 pb-1",
        "before:content-[''] before:absolute before:inset-0 before:scale-y-300 before:scale-x-200 before:bg-black before:rounded-[100%] before:blur-lg before:z-[-2] before:pointer-events-none",
        "before:transition-opacity before:duration-300",
        toastEntries.length > 0
          ? "before:opacity-65 md:before:opacity-30"
          : "before:opacity-0",
        className,
      )}
    >
      <div
        className="w-full h-full overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        }}
      >
        {toastEntries.map((entry) => (
          <div
            key={entry.id}
            className={`absolute inset-0 flex justify-center items-center gap-1.5 text-4xs md:text-3xs text-primary/95 font-normal transition-all duration-300 ease-in-out ${
              entry.phase === "visible"
                ? "opacity-100 translate-y-0"
                : entry.phase === "entering"
                  ? "opacity-0 translate-y-full"
                  : "opacity-0 -translate-y-full"
            }`}
          >
            {entry.icon}
            {entry.text}
            {entry.shortcut && hasKeyboard() && <Kbd>{entry.shortcut}</Kbd>}
          </div>
        ))}
      </div>
    </div>
  );
};
