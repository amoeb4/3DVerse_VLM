import { cn, Panel as BasePanel } from "@3dverse/ui-lib";
import type { ComponentProps } from "react";

const VARIANTS = {
  default: "",
  /** Over the 3D view: blurs what is behind it, a soft shadow. */
  glass: "backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.1)]",
} as const;

//------------------------------------------------------------------------------
/** ui-lib's `Panel`, with a `variant` for the look the viewer's panels share. */
export function Panel({
  variant = "default",
  className,
  ...props
}: ComponentProps<typeof BasePanel> & { variant?: keyof typeof VARIANTS }) {
  return <BasePanel className={cn(VARIANTS[variant], className)} {...props} />;
}
