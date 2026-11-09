import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { ButtonGroup } from "../components/common/ButtonGroup";
import { CnSection } from "../components/monitor/CnSection";
import { ProcessPanel } from "../components/monitor/ProcessPanel";
import { ProductionStrip } from "../components/monitor/ProductionStrip";
import { RemoteActions } from "../components/monitor/RemoteActions";
import { SensorTiles } from "../components/monitor/SensorTiles";
import { SupervisionPanel } from "../components/supervision/SupervisionPanel";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { ALT_CAMERA_ROOM } from "../components/monitor/altCameraLayout";

/**
 * Monitor mode: remote monitoring of the process, for an expert away from the cell. Is the build in
 * spec, and if not, why? The job along the top; the process's indicators and the sensors on the
 * left; on the right, the actions (adjust, stop, assistance) over the cell (link, axes, CN,
 * events).
 *
 * Below `lg`, the panels share one sheet at the bottom of the screen, a tab each.
 */
export function MonitorChrome({
  onOpenAssistance,
  isAltCameraOpen,
  rightSlot,
}: {
  /** To the incident's recovery (`RemoteActions`). */
  onOpenAssistance: () => void;
  /** The alternate camera, under the left column (`AltCamera`): open, or folded to its title. */
  isAltCameraOpen: boolean;
  /**
   * Large screens: under the app's actions, in the right column (`App`), where the cell panel goes.
   * The actions themselves are the app's, kept from one mode to the next.
   */
  rightSlot: HTMLElement | null;
}) {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  return isLargeScreen ? (
    <MonitorColumns isAltCameraOpen={isAltCameraOpen} rightSlot={rightSlot} />
  ) : (
    <MonitorSheet onOpenAssistance={onOpenAssistance} />
  );
}

function MonitorColumns({
  isAltCameraOpen,
  rightSlot,
}: {
  isAltCameraOpen: boolean;
  rightSlot: HTMLElement | null;
}) {
  // The job strip along the top is the app's, shown in every mode.
  return (
    <>
      {/* Above the XR toolbar, bottom left. */}
      <div
        className={cn(
          // Over the alternate camera, itself over the XR toolbar.
          "fixed left-4 top-28 z-40 w-64 xl:w-72 flex flex-col gap-3",
          isAltCameraOpen ? ALT_CAMERA_ROOM.open : ALT_CAMERA_ROOM.folded,
          "starting:opacity-0 starting:-translate-x-4 transition-all duration-500",
        )}
      >
        <ProcessPanel className="min-h-0 shrink" />
        <SensorTiles className="shrink-0" />
      </div>

      {/* The cell, under the app's actions on the right. */}
      {rightSlot &&
        createPortal(
          <SupervisionPanel isOpen docked className="min-h-0 grow">
            <CnSection />
          </SupervisionPanel>,
          rightSlot,
        )}
    </>
  );
}

//------------------------------------------------------------------------------
type SheetTab = "process" | "cell" | "sensors" | "actions";

const TABS: { id: SheetTab; label: string; icon: string }[] = [
  { id: "process", label: "Process", icon: "fa-wave-square" },
  { id: "cell", label: "Cell", icon: "fa-robot" },
  { id: "sensors", label: "Sensors", icon: "fa-video" },
  { id: "actions", label: "Actions", icon: "fa-hand" },
];

function MonitorSheet({ onOpenAssistance }: { onOpenAssistance: () => void }) {
  const [tab, setTab] = useState<SheetTab | null>("process");

  return (
    // Above the XR toolbar, itself over the modes.
    <div className="fixed inset-x-4 bottom-navbar-toolbar z-40 flex flex-col gap-2 max-h-[55vh]">
      <ProductionStrip compact className="self-start max-w-full" />
      <div className="flex items-center gap-2">
        <ButtonGroup>
          {TABS.map(({ id, label, icon }) => (
            <Button
              key={id}
              variant="overlay-outline"
              size="sm"
              className={cn(
                "gap-1.5 before:opacity-100 before:backdrop-blur-xl",
                tab === id && "text-accent-300 before:bg-accent/15",
              )}
              aria-pressed={tab === id}
              // The open tab again folds the sheet away, for the whole 3D view.
              onClick={() =>
                setTab((previous) => (previous === id ? null : id))
              }
            >
              <Icon className={cn("fas text-3xs", icon)} />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </ButtonGroup>
      </div>
      {tab === "process" && <ProcessPanel className="min-h-0" />}
      {/* Mounted on every tab: its telemetry logs the robot starting and stopping. */}
      <SupervisionPanel
        isOpen
        docked
        className={cn("min-h-0", tab !== "cell" && "hidden")}
      >
        <CnSection />
      </SupervisionPanel>
      {tab === "sensors" && <SensorTiles />}
      {tab === "actions" && (
        <RemoteActions onOpenAssistance={onOpenAssistance} />
      )}
    </div>
  );
}
