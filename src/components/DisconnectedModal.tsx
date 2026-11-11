import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, Icon } from "@3dverse/ui-lib";

const RECONNECT_DELAY_MS = 2000;

/**
 * Shown once the session is lost (an idle timeout, the network): reconnects on its own at the
 * viewer's next action, anywhere on the page — moving the mouse, a tap, a key — so there is no
 * button to aim at. Ported from 3dverse-mobile-viewer's `DisconnectedModal`.
 */
export function DisconnectedModal({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    let timer: number | undefined;
    const triggerReconnect = () => {
      if (hasTriggered.current) {
        return;
      }
      hasTriggered.current = true;
      setIsReconnecting(true);
      timer = window.setTimeout(() => onRetry?.(), RECONNECT_DELAY_MS);
    };

    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, triggerReconnect));
    return () => {
      events.forEach((name) =>
        window.removeEventListener(name, triggerReconnect),
      );
      window.clearTimeout(timer);
    };
  }, [onRetry]);

  return (
    <Dialog open>
      <DialogContent className="text-center text-balance border-none">
        {isReconnecting ? (
          <p role="status" className="shimmer text-xs tracking-wide">
            Reconnecting...
          </p>
        ) : (
          <div>
            {/* The original's `fad fa-cloud-xmark` is a Font Awesome Pro icon. */}
            <Icon
              isSlash
              className="fas fa-cloud text-4xl text-accent drop-shadow-[0_12px_24px] drop-shadow-accent"
            />
            <h1 className="mt-4 text-2xl font-semibold">Disconnected</h1>
            <p className="mt-1 text-xs text-secondary tracking-wide">
              Waiting for an action to reconnect.
            </p>
            <p className="mt-10 text-3xs text-secondary">
              <span className="px-2 py-px text-primary/90 bg-accent/40 rounded-md backdrop-blur-2xl [corner-shape:bevel]">
                {error}
              </span>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
