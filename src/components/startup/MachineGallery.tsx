import { useState } from "react";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import Dtext from "../Dtext";
import { MACHINES, type Machine, type MachineStatus } from "../../config";
import { displayNameOf, initialsOf } from "../../utils/clientName";
import { useLiveSessions, type LiveSession } from "./useLiveSessions";

type SceneSelection = { sceneId: string; name: string; sessionId?: string };

const STATUS: Record<MachineStatus, { label: string; className: string }> = {
  operational: {
    label: "Operational",
    className: "bg-positive/15 text-positive border-positive/30",
  },
  "in-progress": {
    label: "In progress",
    className: "bg-warning/15 text-warning-800 border-warning/40",
  },
  deprecated: {
    label: "Deprecated",
    className: "bg-secondary/10 text-secondary border-tertiary",
  },
};

//------------------------------------------------------------------------------
/**
 * The second startup page: one tile per machine, with its picture, whether someone is in it right
 * now (LIVE, from the platform's running sessions), how far its digital twin has come, and what it
 * is made of. Opening a live machine joins the session already running on it.
 */
export function MachineGallery({
  onSubmit,
}: {
  onSubmit: (selection: SceneSelection) => void;
}) {
  const { byScene, available } = useLiveSessions();
  const [customSceneId, setCustomSceneId] = useState("");

  const liveCount = MACHINES.filter((m) => byScene.has(m.sceneId)).length;
  const operationalCount = MACHINES.filter(
    (m) => m.status === "operational",
  ).length;

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-underground">
      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8 md:py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <Dtext />
          <div className="flex flex-wrap gap-2 text-2xs">
            <SummaryPill
              icon="fas fa-industry"
              value={MACHINES.length}
              label="machines"
            />
            <SummaryPill
              icon="fas fa-circle-check"
              value={operationalCount}
              label="operational"
            />
            {available && (
              <SummaryPill
                icon="fas fa-tower-broadcast"
                value={liveCount}
                label="live now"
                highlight={liveCount > 0}
              />
            )}
          </div>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MACHINES.map((machine, index) => (
            <li
              key={machine.sceneId}
              className="starting:opacity-0 starting:translate-y-4 transition-all duration-500"
              style={{ transitionDelay: `${index * 70}ms` }}
            >
              <MachineTile
                machine={machine}
                sessions={byScene.get(machine.sceneId) ?? []}
                onOpen={(sessionId) =>
                  onSubmit({
                    sceneId: machine.sceneId,
                    name: machine.name,
                    sessionId,
                  })
                }
              />
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ sceneId: customSceneId.trim(), name: "Custom scene" });
          }}
          className="mt-8 flex max-w-md items-center gap-2"
        >
          <label
            htmlFor="customSceneId"
            className="text-2xs text-secondary whitespace-nowrap"
          >
            Other scene
          </label>
          <div className="relative flex grow">
            <input
              id="customSceneId"
              type="text"
              className="w-full px-3 py-1 border border-secondary bg-ground text-xs text-tertiary rounded-xl [corner-shape:squircle] focus:outline-hidden focus:ring-2 focus:ring-accent"
              value={customSceneId}
              placeholder="Scene UUID"
              onChange={(e) => setCustomSceneId(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant={customSceneId ? "accent" : "ghost"}
              size="icon-sm"
              aria-label="Open scene"
              className={cn(
                "absolute right-0 top-0 h-full px-4 rounded-l-none",
                customSceneId && "text-white!",
              )}
            >
              <Icon className="fas fa-angle-right text-3xs" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

//------------------------------------------------------------------------------
function SummaryPill({
  icon,
  value,
  label,
  highlight = false,
}: {
  icon: string;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border bg-ground",
        highlight
          ? "border-negative/40 text-negative"
          : "border-tertiary text-secondary",
      )}
    >
      <Icon className={cn(icon, "text-3xs")} />
      <span className="font-semibold tabular-nums text-primary">{value}</span>
      {label}
    </span>
  );
}

//------------------------------------------------------------------------------
function MachineTile({
  machine,
  sessions,
  onOpen,
}: {
  machine: Machine;
  sessions: LiveSession[];
  onOpen: (sessionId?: string) => void;
}) {
  const {
    name,
    description,
    image,
    status,
    specs = [],
    milestones = [],
  } = machine;
  const isDeprecated = status === "deprecated";

  // The busiest session is the one to join.
  const liveSession = [...sessions].sort(
    (a, b) => b.usernames.length - a.usernames.length,
  )[0];
  const liveUsers = liveSession?.usernames ?? [];

  const done = milestones.filter((m) => m.done).length;
  const completion = milestones.length
    ? Math.round((done / milestones.length) * 100)
    : null;
  const next = milestones.find((m) => !m.done);

  return (
    <button
      type="button"
      onClick={() => onOpen(liveSession?.sessionId)}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden text-left cursor-pointer",
        "rounded-2xl [corner-shape:squircle] border bg-ground",
        "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_10px_rgba(0,0,0,0.1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        liveSession
          ? "border-negative/40 hover:border-negative/70"
          : "border-tertiary hover:border-accent/50",
        isDeprecated && "opacity-60 hover:opacity-100",
      )}
    >
      {/* Media */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              "size-full object-contain object-bottom-right transition-transform duration-500 group-hover:scale-105",
              isDeprecated && "grayscale",
            )}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-linear-to-br from-accent/15 via-ground to-accent/5 text-accent/60">
            <Icon className="fas fa-bolt-lightning text-2xl" />
            <span className="text-4xs uppercase tracking-[0.25em]">
              No preview yet
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          {liveSession && <LiveBadge users={liveUsers} />}
          {status && (
            <span
              className={cn(
                "inline-flex items-center h-6 px-2 rounded-full border text-3xs font-medium backdrop-blur-sm",
                STATUS[status].className,
              )}
            >
              {STATUS[status].label}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex grow flex-col gap-3 p-4">
        <div>
          <h2 className="font-orbitron text-lg font-bold text-primary">
            {name}
          </h2>
          {description && (
            <p className="mt-0.5 text-3xs text-secondary">{description}</p>
          )}
        </div>

        {specs.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {specs.map((spec) => (
              <li
                key={spec}
                className="px-2 py-0.5 rounded-md bg-underground text-3xs text-secondary"
              >
                {spec}
              </li>
            ))}
          </ul>
        )}

        {completion !== null && (
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-3xs">
              <span className="text-secondary">Digital twin</span>
              <span className="font-semibold tabular-nums text-primary">
                {completion}%
              </span>
            </div>
            {/* One segment per milestone, so the bar says which steps are done, not just how many. */}
            <div className="flex gap-1" aria-hidden="true">
              {milestones.map((milestone) => (
                <span
                  key={milestone.label}
                  title={`${milestone.label}${milestone.done ? " ✓" : ""}`}
                  className={cn(
                    "h-1.5 grow rounded-full",
                    milestone.done ? "bg-accent" : "bg-tertiary/40",
                  )}
                />
              ))}
            </div>
            {/* <p className="text-3xs text-secondary">
              {next ? (
                <>
                  Next: <span className="text-primary">{next.label}</span>
                </>
              ) : (
                <>
                  <Icon className="fas fa-check text-positive mr-1" />
                  {milestones.map((m) => m.label).join(" · ")}
                </>
              )}
            </p> */}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-tertiary pt-3 text-2xs">
          {liveSession ? (
            <span className="flex items-center gap-2 text-secondary">
              <AvatarStack usernames={liveUsers} />
              {liveUsers.length > 0
                ? `${liveUsers
                    .map((u) => displayNameOf(u))
                    .slice(0, 2)
                    .join(
                      ", ",
                    )}${liveUsers.length > 2 ? ` +${liveUsers.length - 2}` : ""}`
                : "Session running"}
            </span>
          ) : (
            <span className="text-secondary">No one connected</span>
          )}
          <span className="flex items-center gap-1 font-medium text-accent">
            {liveSession ? "Join" : "Open"}
            <Icon className="fas fa-arrow-right text-3xs transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </button>
  );
}

//------------------------------------------------------------------------------
function LiveBadge({ users }: { users: string[] }) {
  return (
    <span className="inline-flex items-center gap-2 h-6 px-2 rounded-full bg-accent text-white text-4xs font-bold tracking-wider">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      LIVE
      {users.length > 0 && (
        <span className="font-normal opacity-90 tabular-nums">
          · {users.length}
        </span>
      )}
    </span>
  );
}

function AvatarStack({ usernames }: { usernames: string[] }) {
  return (
    <span className="flex -space-x-1.5">
      {usernames.slice(0, 3).map((username, i) => (
        <span
          key={`${username}-${i}`}
          title={displayNameOf(username)}
          className="flex size-5 items-center justify-center rounded-full border border-ground bg-accent text-[0.55rem] font-semibold uppercase text-white"
        >
          {initialsOf(username)}
        </span>
      ))}
    </span>
  );
}
