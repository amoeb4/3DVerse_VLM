import { useEffect, useRef, useState } from "react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import { ButtonGroup, Panel, Row, SubTitleSection } from "../components/common";
import { ProgramTimeline } from "../components/preview/ProgramTimeline";
import { formatClock } from "../preview/formatClock";
import { usePlaybackTick } from "../preview/playback";
import { BUNDLED_PROGRAMS, programLabel } from "../preview/programs";
import type { PreviewState, RobotState } from "../preview/usePreview";
import { isTypingInField } from "../shortcuts/isTypingInField";
import { SHORTCUTS } from "../shortcuts/shortcuts";

const AXIS_LABELS = ["J1", "J2", "J3", "J4", "J5", "J6", "Tilt", "Turn"];

/**
 * Preview mode's panels: a part program played back on the cell. On the left, the program (one of
 * those that ship with the app, or a `.mpf` opened from the computer) and the robot following it;
 * at the bottom, the timeline. The part is drawn in the cell as it is laid (`PartInCell`), the
 * robot moved along by inverse kinematics (`usePreview`).
 */
export function PreviewChrome({
  preview,
  machineName,
  toolbar,
}: {
  preview: PreviewState;
  machineName: string;
  /** The camera's toolbar, over the timeline. */
  toolbar?: React.ReactNode;
}) {
  const {
    playback,
    program,
    source,
    setSource,
    withEarlier,
    setWithEarlier,
    robot,
  } = preview;
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = program.status === "ready" ? program : null;

  // Space: play or pause. Captured, so the scene's own space binding (keyBindings.tsx) does not
  // move the camera meanwhile.
  useEffect(() => {
    if (!ready) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== SHORTCUTS.playBuild ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingInField(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      playback.toggle();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [ready, playback]);

  const bundledIndex =
    source?.kind === "bundled"
      ? BUNDLED_PROGRAMS.findIndex((p) => p.name === source.name)
      : -1;

  return (
    <>
      {/* The left sidebar: the program, then the robot. */}
      <div
        className={cn(
          "fixed z-40 top-30 lg:top-28 left-0 w-full md:max-w-96 px-4 flex flex-col gap-2",
          "max-h-[calc(100dvh-var(--spacing-navbar)-16rem)] overflow-y-auto",
          "starting:opacity-0 starting:-translate-y-2 transition-all duration-500",
        )}
      >
        <Panel variant="glass" className="flex flex-col gap-2.5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <SubTitleSection as="span">Program</SubTitleSection>
            {BUNDLED_PROGRAMS.length > 0 && (
              <Button
                variant="outline"
                size="2xs"
                className={cn(
                  "gap-1.5",
                  preview.autoplay && "text-accent-300 bg-accent/15",
                )}
                aria-pressed={preview.autoplay}
                title={`Play ${BUNDLED_PROGRAMS.map((p) => programLabel(p.name)).join(", then ")}, and again, in a loop`}
                onClick={() => preview.setAutoplay(!preview.autoplay)}
              >
                <Icon className="fas fa-repeat text-[9px]" />
                Autoplay
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {BUNDLED_PROGRAMS.length > 0 && (
              <ButtonGroup isAttached className="grow min-w-0">
                {BUNDLED_PROGRAMS.map((candidate) => {
                  const isOn =
                    source?.kind === "bundled" &&
                    source.name === candidate.name;
                  return (
                    <Button
                      key={candidate.name}
                      variant="outline"
                      size="xs"
                      className={cn(
                        "grow min-w-0 text-2xs",
                        isOn && "text-accent-300 bg-accent/15",
                      )}
                      aria-pressed={isOn}
                      onClick={() => setSource(candidate)}
                    >
                      {programLabel(candidate.name)}
                    </Button>
                  );
                })}
              </ButtonGroup>
            )}
            <Button
              variant="outline"
              size="xs"
              className={cn(
                "gap-1.5 text-2xs shrink-0",
                source?.kind === "file" && "text-accent-300 bg-accent/15",
              )}
              title="Open a part program (.mpf) from this computer"
              onClick={() => fileInput.current?.click()}
            >
              <Icon className="fas fa-folder-open text-3xs" />
              Open…
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".mpf,.MPF,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  // Autoplay plays the bundled programs only.
                  preview.setAutoplay(false);
                  setSource({ kind: "file", name: file.name, file });
                }
                event.target.value = "";
              }}
            />
          </div>

          {bundledIndex > 0 && (
            <label className="flex items-center gap-2 text-3xs text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={withEarlier}
                onChange={(event) => setWithEarlier(event.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Show{" "}
              {BUNDLED_PROGRAMS.slice(0, bundledIndex)
                .map((p) => programLabel(p.name))
                .join(" and ")}{" "}
              laid already
            </label>
          )}

          {program.status === "loading" && (
            <p className="text-3xs text-secondary">
              <Icon className="fas fa-spinner fa-spin mr-1.5" />
              Reading {program.name}…
            </p>
          )}
          {program.status === "error" && (
            <p className="text-3xs text-negative">
              Could not read {program.name}: {program.message}
            </p>
          )}
          {ready && (
            <div className="flex flex-col gap-1">
              <Row label="Operation" value={ready.program.operation} />
              <Row label="Layers" value={ready.program.layers} />
              <Row label="Beads" value={ready.program.beads.length} />
              <Row
                label="Moves"
                value={ready.program.count.toLocaleString("en")}
              />
              <Row
                label="Length, at its feeds"
                value={formatClock(ready.program.duration)}
              />
            </div>
          )}
        </Panel>

        <Panel variant="glass" className="flex flex-col gap-2.5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <SubTitleSection as="span">Robot</SubTitleSection>
            <span className="text-3xs text-secondary truncate">
              {machineName}
            </span>
          </div>
          <RobotStatus robot={robot} />
          {robot.status === "ready" && (
            <ContestedNotice contestedAt={preview.contestedAt} />
          )}
          {robot.status === "ready" && <RobotAxes preview={preview} />}
        </Panel>
      </div>

      {/* The bottom stack, at the centre, over the modes: the toolbar, then the timeline. */}
      <div className="fixed z-40 inset-x-4 bottom-navbar flex flex-col items-center gap-2 pointer-events-none *:pointer-events-auto">
        {toolbar}
        {ready && (
          <Panel variant="glass" className="w-full lg:w-184 max-w-full p-2">
            <ProgramTimeline
              program={ready.program}
              playback={playback}
              solution={robot.status === "ready" ? robot.solution : null}
            />
          </Panel>
        )}
      </div>
    </>
  );
}

/** Seconds after someone else last moved the arm that the notice stays. */
const CONTESTED_NOTICE_S = 5;

/**
 * Someone else moves the arm too: another viewer of this session (another tab, another device)
 * applying the live feed, or another app. Each time, the playback takes it back, but the arm
 * flickers between the two.
 */
function ContestedNotice({ contestedAt }: { contestedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (contestedAt === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [contestedAt]);
  if (contestedAt === null || now - contestedAt > CONTESTED_NOTICE_S * 1000) {
    return null;
  }
  return (
    <p className="text-3xs text-warning">
      <Icon className="fas fa-people-arrows mr-1.5" />
      Someone else is moving the arm too: another viewer of this session (a tab
      or a device following the live feed) or another app. Close it, or stop its
      feed, for the arm to follow the program alone.
    </p>
  );
}

//------------------------------------------------------------------------------
function RobotStatus({ robot }: { robot: RobotState }) {
  switch (robot.status) {
    case "none":
      return (
        <p className="text-3xs text-secondary">
          This robot&apos;s axes are not described yet: the program&apos;s path
          is shown, the robot does not move.
        </p>
      );
    case "waiting":
      return (
        <p className="text-3xs text-secondary">
          <Icon className="fas fa-spinner fa-spin mr-1.5" />
          Waiting for the robot in the scene…
        </p>
      );
    case "unavailable":
    case "error":
      return (
        <p className="text-3xs text-warning">
          The robot cannot follow the program:{" "}
          {robot.status === "error" ? robot.message : robot.reason}
        </p>
      );
    case "solving":
      return (
        <div className="flex flex-col gap-1">
          <p className="text-3xs text-secondary">
            Solving the axes for every move…{" "}
            <span className="tabular-nums">
              {Math.floor(robot.progress * 100)} %
            </span>
          </p>
          <div className="h-1 rounded-full bg-tertiary/30 overflow-hidden">
            <div
              className="h-full bg-accent-300 transition-[width]"
              style={{ width: `${robot.progress * 100}%` }}
            />
          </div>
        </div>
      );
    case "ready": {
      const { unreachable, worstMm, worstDeg } = robot.solution;
      return unreachable === 0 ? (
        <p className="text-3xs text-secondary">
          <Icon className="fas fa-circle-check text-positive mr-1.5" />
          Every move within reach. The live feed is paused while the program
          plays.
        </p>
      ) : (
        <p className="text-3xs text-warning">
          <Icon className="fas fa-triangle-exclamation mr-1.5" />
          {unreachable.toLocaleString("en")} moves out of reach (up to{" "}
          {worstMm.toFixed(1)} mm, {worstDeg.toFixed(1)}°), marked on the
          timeline.
        </p>
      );
    }
  }
}

/** The axes as they stand, from the scene's pose: the arm's six, the positioner's two. */
function RobotAxes({ preview }: { preview: PreviewState }) {
  usePlaybackTick(preview.playback);
  const pose = preview.poseNow();
  if (!pose) return null;
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-1">
      {AXIS_LABELS.map((label, i) => (
        <div key={label} className="flex flex-col">
          <span className="text-4xs text-secondary">{label}</span>
          <span className="text-3xs font-bold tabular-nums">
            {pose[i].toFixed(1)}°
          </span>
        </div>
      ))}
    </div>
  );
}
