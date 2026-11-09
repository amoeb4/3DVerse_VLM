import { cn, Icon } from "@3dverse/ui-lib";

import type { ParticipantLook } from "./participantLook";

/** What an avatar shows inside: the initials, or an expert's headset. */
export function ParticipantMark({
  look,
  className,
}: {
  look: ParticipantLook;
  className?: string;
}) {
  return look.isExpert ? (
    <Icon className={cn("fas fa-headset", className)} aria-label="Expert" />
  ) : (
    <>{look.initials}</>
  );
}
