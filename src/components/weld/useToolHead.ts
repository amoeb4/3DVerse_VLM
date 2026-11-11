import { useCallback } from "react";
import { useEntity } from "@3dverse/livelink-react";

import {
  FRONIUS_TORCH_EUID,
  HEAD_LIGHT_EUID,
  MILLING_SPINDLE_EUID,
} from "./torch";

/** The two tools the arm's flange carries (`torch.ts`). */
export type Tool = "torch" | "spindle";

export const TOOL_LABELS: Record<Tool, string> = {
  torch: "Fronius torch",
  spindle: "Milling spindle",
};

/**
 * The arm's tool head, for the View menu: its light, and which of its two tools is mounted.
 *
 * Both are entities of the shared scene, shown or hidden: what is switched here is switched for
 * everyone in the session, and what someone else switches shows here (`useEntity` follows an
 * entity's visibility). They exist in NJ130 2.05 only: elsewhere there is no head light
 * (`hasHeadLight`) and no tool (`tool` is `null`).
 */
export function useToolHead() {
  const { entity: headLight } = useEntity({ euid: HEAD_LIGHT_EUID });
  const { entity: torch } = useEntity({ euid: FRONIUS_TORCH_EUID });
  const { entity: spindle } = useEntity({ euid: MILLING_SPINDLE_EUID });

  // Training shows and hides each tool on its own (`TorchExample`): the torch counts as mounted
  // whenever it is shown, the spindle otherwise.
  const tool: Tool | null =
    torch && spindle ? (torch.is_visible ? "torch" : "spindle") : null;
  const otherTool: Tool | null =
    tool && (tool === "torch" ? "spindle" : "torch");

  const toggleHeadLight = useCallback(() => {
    if (headLight) {
      headLight.is_visible = !headLight.is_visible;
    }
  }, [headLight]);

  // One tool for the other: never both, never neither.
  const switchTool = useCallback(() => {
    if (!torch || !spindle) {
      return;
    }
    const isTorchNext = !torch.is_visible;
    torch.is_visible = isTorchNext;
    spindle.is_visible = !isTorchNext;
  }, [torch, spindle]);

  return {
    hasHeadLight: headLight !== null,
    isHeadLightOn: headLight?.is_visible ?? false,
    toggleHeadLight,
    /** The tool mounted; `null` where the scene has none. */
    tool,
    /** The one `switchTool` mounts. */
    otherTool,
    switchTool,
  };
}
