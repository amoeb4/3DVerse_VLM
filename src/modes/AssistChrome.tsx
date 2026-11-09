import { useState } from "react";
import type { DefaultCameraController } from "@3dverse/livelink-react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { useAssist } from "../assist/assistContext";
import type { IncidentKind } from "../assist/procedures";
import { ButtonGroup } from "../components/common/ButtonGroup";
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
 * app's actions (E-Stop, adjust) with who is in the session (`App`). "Run the diagnostic" goes
 * through the robot's checkpoints one at a time, in a panel at the centre (`DiagnosticRunPanel`).
 * Pinning a note, following the other's camera and the camera's reset are in the toolbar at the
 * bottom centre (`AssistActions`). All of it shared through the session (`assistStore.ts`).
 *
 * Everyone is the operator, unless their URL says `?role=expert` (`useAssistRole`). Below `lg`,
 * the panels share a sheet, a tab each.
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
        <AssistSheet onRequest={openRequest} onBack={onBack} />
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
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
}) {
  const { incident } = useAssist();
  return incident ? (
    <IncidentPanel className="min-h-0" />
  ) : (
    <Diagnostic onRequest={onRequest} className="min-h-0" />
  );
}

/** Large screens: the left column. The right one is the app's (`App`). */
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
  onBack,
}: {
  onRequest: (kind: IncidentKind, note?: string) => void;
  onBack: () => void;
}) {
  const { incident } = useAssist();
  const [tab, setTab] = useState<SheetTab | null>("main");
  // The first tab is the Diagnostic, or the incident once one is open.
  const tabs: { id: SheetTab; label: string; icon: string }[] = [
    incident
      ? { id: "main", label: "Incident", icon: "fa-triangle-exclamation" }
      : { id: "main", label: "Diagnostic", icon: "fa-stethoscope" },
    { id: "actions", label: "Actions", icon: "fa-hand" },
  ];

  return (
    // Above the toolbars, themselves over the modes: AR is for the operator at the machine, on a phone.
    <div className="fixed inset-x-4 bottom-navbar-toolbar z-40 flex flex-col gap-2 max-h-[60vh]">
      <BackToMonitoring onClick={onBack} />
      <ButtonGroup className="self-start">
        {tabs.map(({ id, label, icon }) => (
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
            onClick={() => setTab((previous) => (previous === id ? null : id))}
          >
            <Icon className={cn("fas text-3xs", icon)} />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </ButtonGroup>
      {tab === "main" && <MainPanel onRequest={onRequest} />}
      {tab === "actions" && (
        <ActionsWithPeople className="min-h-0 overflow-y-auto" />
      )}
    </div>
  );
}
