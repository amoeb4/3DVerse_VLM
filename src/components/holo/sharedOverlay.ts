import { createContext, useContext, useEffect, useState } from "react";
import type { Viewport } from "@3dverse/livelink";

import { HoloOverlay } from "./HoloOverlay";

/**
 * The viewport's one Three.js overlay, shared by everything drawn over the stream (the HUD, the part
 * in construction): Livelink composites a single canvas overlay per viewport. It is added to the
 * viewport while something uses it, and removed when nothing does.
 */
export class SharedOverlay {
  readonly #viewport: Viewport;
  #overlay: HoloOverlay | null = null;
  #users = 0;

  constructor(viewport: Viewport) {
    this.#viewport = viewport;
  }

  acquire(): HoloOverlay {
    if (!this.#overlay) {
      this.#overlay = new HoloOverlay({ viewport: this.#viewport });
      this.#viewport.addOverlay({ overlay: this.#overlay });
    }
    this.#users += 1;
    return this.#overlay;
  }

  release() {
    this.#users -= 1;
    if (this.#users === 0 && this.#overlay) {
      // Releases the overlay and redraws the frame without it.
      this.#viewport.removeOverlay({ overlay: this.#overlay });
      this.#overlay = null;
    }
  }
}

export const SharedOverlayContext = createContext<SharedOverlay | null>(null);

/**
 * The shared overlay, held while the calling component is mounted; `null` until it is ready. Must
 * be called under a `SharedOverlayProvider`.
 */
export function useSharedOverlay(): HoloOverlay | null {
  const shared = useContext(SharedOverlayContext);
  const [overlay, setOverlay] = useState<HoloOverlay | null>(null);
  useEffect(() => {
    if (!shared) return;
    setOverlay(shared.acquire());
    return () => {
      setOverlay(null);
      shared.release();
    };
  }, [shared]);
  return overlay;
}
