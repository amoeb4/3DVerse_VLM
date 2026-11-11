import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@3dverse/ui-lib";

import { ModeSheet, type ModeSheetTab } from "../components/common/ModeSheet";
import { CnSection } from "../components/monitor/CnSection";
import { ProcessPanel } from "../components/monitor/ProcessPanel";
import { RemoteActions } from "../components/monitor/RemoteActions";
import { SensorTiles } from "../components/monitor/SensorTiles";
import {
  JointTelemetryRecorder,
  SupervisionPanel,
} from "../components/supervision/SupervisionPanel";
import { WeldPanel } from "../components/monitor/WeldPanel";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { ALT_CAMERA_ROOM } from "../components/monitor/altCameraLayout";

/**
 * Monitor mode: remote monitoring of the process, for an expert away from the cell. Is the build in
 * spec, and if not, why? The job along the top; the process's indicators and the sensors on the
 * left; on the right, the actions (adjust, stop, assistance) over the welding and the cell (link,
 * axes, CN, events).
 *
 * Below `lg`, the panels share one sheet, a tab each, closed at first (`ModeSheet`).
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

      {/* The welding, then the cell, under the app's actions on the right. */}
      {rightSlot &&
        createPortal(
          <>
            <WeldPanel className="shrink-0" />
            <SupervisionPanel className="grow">
              <CnSection />
            </SupervisionPanel>
          </>,
          rightSlot,
        )}
    </>
  );
}

//------------------------------------------------------------------------------
type SheetTab = "process" | "cell" | "sensors" | "actions";

const TABS: ModeSheetTab<SheetTab>[] = [
  { id: "process", label: "Process", icon: "fa-wave-square" },
  { id: "cell", label: "Cell", icon: "fa-robot" },
  { id: "sensors", label: "Sensors", icon: "fa-video" },
  { id: "actions", label: "Actions", icon: "fa-hand" },
];

function MonitorSheet({ onOpenAssistance }: { onOpenAssistance: () => void }) {
  const [tab, setTab] = useState<SheetTab>("process");

  return (
    <>
      {/* The sheet's panels are only mounted while it is open: the log goes on meanwhile. */}
      <JointTelemetryRecorder />
      <ModeSheet
        label="Monitoring"
        icon="fa-gauge-high"
        tabs={TABS}
        tab={tab}
        onTabChange={setTab}
      >
        {tab === "process" && <ProcessPanel />}
        {tab === "cell" && (
          <>
            <WeldPanel />
            <SupervisionPanel>
              <CnSection />
            </SupervisionPanel>
          </>
        )}
        {tab === "sensors" && <SensorTiles />}
        {tab === "actions" && (
          <RemoteActions onOpenAssistance={onOpenAssistance} />
        )}
      </ModeSheet>
    </>
  );
}
