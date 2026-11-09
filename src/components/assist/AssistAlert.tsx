import { Button, cn, DotPing, Icon } from "@3dverse/ui-lib";

import { authorLabel, useAssist } from "../../assist/assistContext";
import { INCIDENT_KINDS } from "../../assist/procedures";

/**
 * In the other modes, while someone in the session asks for help: says so, and opens Assistance.
 * The in-app side of what a notification to the experts' phones would do.
 */
export function AssistAlert({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className?: string;
}) {
  const { incident } = useAssist();
  if (!incident) return null;
  const label = INCIDENT_KINDS[incident.kind].label;

  return (
    <Button
      variant="overlay-outline"
      size="sm"
      className={cn(
        "gap-1.5 text-warning before:opacity-100 before:backdrop-blur-xl",
        className,
      )}
      title={`${authorLabel(incident.by)} asked for help: ${label}. Open Assistance.`}
      onClick={onOpen}
    >
      <DotPing isActive className="text-warning" />
      <Icon className="fas fa-life-ring text-2xs" />
      <span className="hidden sm:inline">Help requested ·</span> {label}
    </Button>
  );
}
