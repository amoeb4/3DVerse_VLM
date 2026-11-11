import { useEffect, useRef } from "react";
import { useEntity } from "@3dverse/livelink-react";

import { FRONIUS_TORCH_EUID, MILLING_SPINDLE_EUID } from "./torch";

/**
 * The arm carries the Fronius torch: on joining the session, shows it and hides the milling spindle
 * mounted on the same flange. Once per session, so the View menu (`useToolHead`) and Training's
 * tool buttons (`TorchExample`) can switch them afterwards. Mount once, inside `Livelink`.
 */
export function useFroniusTorchByDefault() {
  const { entity: torch } = useEntity({ euid: FRONIUS_TORCH_EUID });
  const { entity: spindle } = useEntity({ euid: MILLING_SPINDLE_EUID });
  const isApplied = useRef(false);

  useEffect(() => {
    if (isApplied.current || !torch || !spindle) {
      return;
    }
    isApplied.current = true;
    torch.is_visible = true;
    spindle.is_visible = false;
  }, [torch, spindle]);
}
