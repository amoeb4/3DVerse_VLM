import { useState } from "react";
import type { DefaultCameraController } from "@3dverse/livelink-react";
import { cn } from "@3dverse/ui-lib";

import { useAssist } from "../assist/assistContext";
import type { IncidentKind } from "../assist/procedures";
import { ModeSheet, type ModeSheetTab } from "../components/common/ModeSheet";
import { IncidentPanel } from "../components/assist/IncidentPanel";
import { PeopleSection } from "../components/assist/PeopleSection";
import { Diagnostic } from "../components/assist/Diagnostic";
import { RequestDialog } from "../components/assist/RequestDialog";
import { RemoteActions } from "../components/monitor/RemoteActions";
import { BackButton } from "../components/common/BackButton";
import { DiagnosticRunPanel } from "../components/assist/DiagnosticRunPanel";
import { useMediaQuery } from "../hooks/useMediaQuery";

/** The Diagnostic mode is already open: its actions' Diagnostic button leads nowhere. */
const stayHere = () => {};

/**
 * The Diagnostic (the `assistance` mode): an operator at the machine and a remote expert, back to
 * production together. On the left, the Diagnostic (`Diagnostic`): an incident is opened, or an
 * expert asked for, from there only, once the cell has been looked at. Once an incident is open,
 * the incident (alarm, block, trace, cameras, and closing it) takes its place. On the right, the
 * app's actions (E-Stop, adjust) with who is in the session (`ViewerRightColumn`). "Run the
 * diagnostic" goes through the robot's checkpoints one at a time, in a panel at the centre
 * (`DiagnosticRunPanel`).
 * Pinning a note, following the other's camera and the camera's reset are in the toolbar at the
 * bottom centre (`AssistActions`). All of it shared through the session (`assistStore.ts`).
 *
 * Everyone is the operator, unless their URL says `?role=expert` (`useAssistRole`). Below `lg`,
 * the panels share a sheet, a tab each, closed at first (`ModeSheet`); back to monitoring is the
 * navbar's Monitor.
 */
export function AssistChrome({
  onBack,
  cameraController,
  onResetCamera,
}: {
  /** Back to the Monitor mode: the incident and its notes stay open. */
  onBack: () => void;
  /** For the diagnostic's run, which brings the camera to each checkpoint. */
  cameraController: DefaultCameraController | null;
  /** The camera back to the scene's default point of view (`useResetCamera`), as the run ends. */
  onResetCamera: () => void;
}) {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  // What the Diagnostic found happened, and what its run found, for the request to start from.
  const [requestKind, setRequestKind] =
    useState<IncidentKind>("torch-collision");
  const [requestNote, setRequestNote] = useState<string | undefined>();
  const openRequest = (kind: IncidentKind, note?: string) => {
    setRequestKind(kind);
    setRequestNote(note);
    setIsRequestOpen(true);
  };

  return (
    <>
      {isLargeScreen ? (
        <AssistColumn onRequest={openRequest} onBack={onBack} />
      ) : (
        <AssistSheet onRequest={openRequest} />
      )}
      <DiagnosticRunPanel
        cameraController={cameraController}
        onAskExpert={openRequest}
        onEnd={onResetCamera}
      />
      <RequestDialog
        open={isRequestOpen}
        onOpenChange={setIsRequestOpen}
        initialKind={requestKind}
        initialNote={requestNote}
      />
    </>
  );
}

function BackToMonitoring({ onClick }: { onClick: () => void }) {
  return (
    <BackButton
      label="Back to monitoring"
      title="Back to the Monitor mode: the incident and its notes stay open"
      onClick={onClick}
    />
  );
}

/** The actions, holding who is in the session. */
function ActionsWithPeople({ className }: { className?: string }) {
  return (
    <RemoteActions
      onOpenAssistance={stayHere}
      inAssistance
      className={className}
    >
      <PeopleSection />
    </RemoteActions>
  );
}

/** The Diagnostic, or the incident once one is open. */
function MainPanel({
  onRequest,
  className = "min-h-0",
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
  className?: string;
}) {
  const { incident } = useAssist();
  return incident ? (
    <IncidentPanel className={className} />
  ) : (
    <Diagnostic onRequest={onRequest} className={className} />
  );
}

/** Large screens: the left column. The right one is the app's (`ViewerRightColumn`). */
function AssistColumn({
  onRequest,
  onBack,
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
  onBack: () => void;
}) {
  return (
    // Under the job strip, above the XR buttons, bottom left.
    <div
      className={cn(
        "fixed left-4 top-28 bottom-toolbar z-40 w-80 xl:w-96 flex flex-col gap-2",
        "starting:opacity-0 starting:-translate-x-4 transition-all duration-500",
      )}
    >
      <BackToMonitoring onClick={onBack} />
      <MainPanel onRequest={onRequest} />
    </div>
  );
}

//------------------------------------------------------------------------------
type SheetTab = "main" | "actions";

function AssistSheet({
  onRequest,
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
}) {
  const { incident } = useAssist();
  const [tab, setTab] = useState<SheetTab>("main");
  // The first tab is the Diagnostic, or the incident once one is open.
  const main: ModeSheetTab<SheetTab> = incident
    ? { id: "main", label: "Incident", icon: "fa-triangle-exclamation" }
    : { id: "main", label: "Diagnostic", icon: "fa-stethoscope" };
  const tabs: ModeSheetTab<SheetTab>[] = [
    main,
    { id: "actions", label: "Actions", icon: "fa-hand" },
  ];

  return (
    <ModeSheet
      label={main.label}
      icon={main.icon}
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
    >
      {/* Both stay mounted: what is typed in the Diagnostic is kept from one tab to the other. */}
      <MainPanel
        onRequest={onRequest}
        className={cn(tab !== "main" && "hidden")}
      />
      <ActionsWithPeople className={cn(tab !== "actions" && "hidden")} />
    </ModeSheet>
  );
}
