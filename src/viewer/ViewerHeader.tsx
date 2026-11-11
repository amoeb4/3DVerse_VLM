import { Link } from "react-router";
import type { DefaultCameraController } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { AssistAlert } from "../components/assist/AssistAlert";
import { LiveBadge } from "../components/LiveBadge";
import { Toolbar } from "../components/Toolbar";
import type { ViewMode } from "../modes/modes";
import { HOME_PATH } from "../routing";

/**
 * The viewer's header, in every mode: back to Home, the machine's name, whether it is live, the
 * incident's alert; on the right, the people and "Ask an expert" (`Toolbar`). Below `lg`, it wraps
 * before the toolbar on the right.
 */
export function ViewerHeader({
  machineName,
  mode,
  cameraController,
  onOpenAssistance,
}: {
  machineName: string;
  mode: ViewMode;
  cameraController: DefaultCameraController | null;
  /** To the Assistance mode, from the incident's alert and "Ask an expert". */
  onOpenAssistance: () => void;
}) {
  const isTrainingMode = mode === "training";
  const isAssistMode = mode === "assistance";

  return (
    <header
      className={cn(
        // A container: on a phone, its live badge is the dot alone (`LiveBadge`).
        "@container absolute top-0 left-0 px-3 py-4 md:px-4 flex justify-between items-center gap-x-1 w-full z-50",
        "starting:opacity-0 starting:-translate-y-4 transition-all duration-500",
      )}
    >
      <div className="flex items-center gap-2 md:gap-3 min-w-0 starting:opacity-0 starting:-translate-y-4 transition-all duration-500">
        <Button
          as={Link}
          to={HOME_PATH}
          variant="ghost"
          size="icon-lg"
          className="text-primary"
          title="Back to Home"
          aria-label="Back to Home"
        >
          <Icon className="fas fa-arrow-left text-2xs" />
        </Button>
        <h1 className="font-orbitron text-xl font-bold mr-2 min-w-0 truncate">
          {machineName}
        </h1>
        {!isTrainingMode && <LiveBadge collapsible />}

        {!isAssistMode && (
          <AssistAlert onOpen={onOpenAssistance} className="lg:ml-2" />
        )}
      </div>
      <Toolbar
        cameraController={cameraController}
        onOpenAssistance={onOpenAssistance}
      />
    </header>
  );
}
