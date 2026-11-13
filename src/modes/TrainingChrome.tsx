import { useState } from "react";
import type { Entity } from "@3dverse/livelink";
import { cn } from "@3dverse/ui-lib";

import { ModeSheet, type ModeSheetTab } from "../components/common";
import { EntityStatusPanel } from "../components/EntityPicking";
import TrainingPanel from "../components/TrainingPanel";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { EntityCreator } from "../weldBead";

type SheetTab = "controls" | "welding";

const TABS: ModeSheetTab<SheetTab>[] = [
  { id: "controls", label: "Controls", icon: "fa-sliders" },
  { id: "welding", label: "Welding", icon: "fa-fire" },
];

/**
 * Training mode: every tool the viewer has had, mocks included. The controls, the welding by hand
 * and the entity under the pointer, in a column on the left.
 *
 * Below `lg`, the controls and the welding share a sheet (`ModeSheet`), a tab each; the entity
 * under the pointer stays at the top, in sight while one taps on the cell.
 */
export function TrainingChrome({
  hoveredEntity,
  pickedEntity,
}: {
  hoveredEntity: Entity | null;
  pickedEntity: Entity | null;
}) {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = useState<SheetTab>("controls");

  const status = (
    <EntityStatusPanel
      hoveredEntity={hoveredEntity}
      pickedEntity={pickedEntity}
    />
  );

  if (isLargeScreen) {
    return (
      <div className="fixed top-17 left-4 z-50 flex flex-col gap-1 w-full max-w-md">
        <TrainingPanel />
        <EntityCreator />
        {status}
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-15 left-4 z-40">{status}</div>
      <ModeSheet
        label="Training"
        icon="fa-graduation-cap"
        tabs={TABS}
        tab={tab}
        onTabChange={setTab}
      >
        {/* Both stay mounted: the sliders keep their values from one tab to the other. */}
        <TrainingPanel className={cn(tab !== "controls" && "hidden")} />
        <EntityCreator className={cn(tab !== "welding" && "hidden")} />
      </ModeSheet>
    </>
  );
}
