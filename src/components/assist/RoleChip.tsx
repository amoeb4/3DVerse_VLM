import { cn, Icon } from "@3dverse/ui-lib";

import {
  ROLE_ICONS,
  ROLE_LABELS,
  type AssistRole,
} from "../../assist/procedures";

/** Someone's role in Assistance, or who does a step: the expert's tag is the accent. */
export function RoleChip({
  role,
  className,
}: {
  role: AssistRole;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border shrink-0",
        "text-[10px] font-bold tracking-wider uppercase whitespace-nowrap",
        role === "expert"
          ? "text-accent-300 border-accent/40 bg-accent/10"
          : "text-primary border-secondary",
        className,
      )}
    >
      <Icon className={cn("fas", ROLE_ICONS[role])} />
      {ROLE_LABELS[role]}
    </span>
  );
}
