import { useContext, useEffect, useRef } from "react";
import {
  LivelinkContext,
  type DefaultCameraController,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

/** How often, at most, the camera sets off again towards the followed one. */
const RETARGET_MS = 120;

/**
 * Keeps this viewer's camera on another participant's: "follow the expert". It eases after it, as
 * the other camera moves. `onStop` is called when it cannot follow any more: that participant has
 * left, or has no camera (a guest without a viewport).
 *
 * While following, the camera is driven: stop following to take it back.
 */
export function useFollow(
  controller: DefaultCameraController | null,
  clientId: string | null,
  onStop: () => void,
) {
  const { instance } = useContext(LivelinkContext);
  const onStopRef = useRef(onStop);
  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  useEffect(() => {
    if (!controller || !clientId || !instance) return;
    const session = instance.session;
    const client = session.getClient({ client_id: clientId });
    if (!client) {
      onStopRef.current();
      return;
    }

    let cancelled = false;
    let camera: Entity | null = null;
    let frame = 0;
    let lastKey = "";
    let lastTravel = 0;
    let lastPresenceCheck = 0;

    void client.getCameraEntities().then((cameras) => {
      if (cancelled) return;
      camera = cameras[0] ?? null;
      if (!camera) onStopRef.current();
    });

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastPresenceCheck > 1000) {
        lastPresenceCheck = now;
        if (!session.getClient({ client_id: clientId })) {
          onStopRef.current();
          return;
        }
      }
      if (!camera || now - lastTravel < RETARGET_MS) return;
      const { position, orientation } = camera.global_transform;
      const key = [...position, ...orientation].map((v) => v.toFixed(4)).join();
      if (key === lastKey) return;
      lastKey = key;
      lastTravel = now;
      void controller.travelToPointOfView({ position, orientation });
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [controller, clientId, instance]);
}
