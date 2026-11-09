import { useContext, useEffect, useState } from "react";
import { ViewportContext } from "@3dverse/livelink-react";

import { SharedOverlay, SharedOverlayContext } from "./sharedOverlay";

/** Shares one overlay among its children. Must be rendered inside a `Viewport`. */
export function SharedOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { viewport } = useContext(ViewportContext);
  const [shared, setShared] = useState<SharedOverlay | null>(null);
  useEffect(() => {
    setShared(viewport ? new SharedOverlay(viewport) : null);
  }, [viewport]);
  return (
    <SharedOverlayContext.Provider value={shared}>
      {children}
    </SharedOverlayContext.Provider>
  );
}
