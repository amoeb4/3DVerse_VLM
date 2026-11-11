import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";

import type { PickedPoint } from "../assist/AssistProvider";
import { useWasDragged } from "../hooks/useWasDragged";

/**
 * Selecting entities in the 3D view: the one clicked (highlighted in the scene) and the one under
 * the pointer (the cursor turns to a hand over it). `onPick` and `onHover` go to the viewport.
 *
 * `enabled` is Training's: out of it nothing is selected, and nothing stays selected.
 *
 * `pickInterceptor` is for whoever takes the click before the selection does: Assistance, while a
 * note is being placed on the cell (`AssistProvider`).
 */
export function useEntityPicking({ enabled }: { enabled: boolean }) {
  const { instance } = useContext(LivelinkContext);
  const scene = instance?.scene;

  const [pickedEntity, setPickedEntity] = useState<{ entity: Entity } | null>(
    null,
  );
  const [hoveredEntity, setHoveredEntity] = useState<{ entity: Entity } | null>(
    null,
  );

  // Read through a ref, so the viewport's picking is not torn down and set up again at each mode
  // switch.
  const isEnabledRef = useRef(enabled);
  const pickInterceptor = useRef<((picked: PickedPoint) => boolean) | null>(
    null,
  );
  // Turning the camera ends with a click too: that one picks nothing.
  const wasDragged = useWasDragged();

  const onPick = useCallback(
    (picked: PickedPoint | null) => {
      if (wasDragged.current) {
        return;
      }
      if (picked && pickInterceptor.current?.(picked)) {
        return;
      }
      if (isEnabledRef.current) {
        setPickedEntity(picked);
      }
    },
    [wasDragged],
  );
  const onHover = useCallback((hovered: { entity: Entity } | null) => {
    setHoveredEntity(isEnabledRef.current ? hovered : null);
  }, []);

  useEffect(() => {
    isEnabledRef.current = enabled;
  }, [enabled]);

  // Once disabled, nothing stays selected.
  useEffect(() => {
    if (!enabled) {
      setPickedEntity(null);
      setHoveredEntity(null);
    }
  }, [enabled]);

  useEffect(() => {
    document.body.style.cursor = hoveredEntity ? "pointer" : "default";
    // Leaving the viewer while over an entity must not keep the pointer on the gallery.
    return () => {
      document.body.style.cursor = "default";
    };
  }, [hoveredEntity]);

  useEffect(() => {
    scene?.highlightEntities({
      entities: pickedEntity ? [pickedEntity.entity] : [],
    });
  }, [scene, pickedEntity]);

  return {
    pickedEntity: pickedEntity?.entity ?? null,
    hoveredEntity: hoveredEntity?.entity ?? null,
    onPick,
    onHover,
    pickInterceptor,
  };
}
