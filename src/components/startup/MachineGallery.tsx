import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate } from "react-router";
import { Button, cn, Icon } from "@3dverse/ui-lib";

import Dtext from "../Dtext";
import { MACHINES, type Machine } from "../../config";
import { MACHINE_STATUS } from "./machineStatus";
import { displayNameOf, initialsOf } from "../../utils/clientName";
import { useLiveSessions, type LiveSession } from "./useLiveSessions";
import { MachinePreview, type PreviewStatus } from "./MachinePreview";
import { MachineInsights } from "./MachineInsights";
import { useIncidentDigests } from "../../assist/incidentDigest";
import { viewerPath } from "../../routing";

/**
 * With no one at the page for this long, the 3D previews close their sessions and the tiles go
 * back to their pictures; they open again on the next move. The streams already pause while the
 * tab is hidden, but the sessions would stay open on the platform.
 */
const PREVIEW_IDLE_MS = 5 * 60_000;

/**
 * TEMPORARY: the tiles' live 3D previews (`MachinePreview`) are off — no Livelink session or canvas
 * is opened from this page, and every tile shows its picture. Set back to `true` to bring them back.
 */
const SHOW_3D_PREVIEWS = false;

//------------------------------------------------------------------------------
/**
 * The second startup page: one tile per machine, with its picture, whether someone is in it right
 * now (LIVE, from the platform's running sessions), and a digest of where it stands — the machine,
 * its production order, the part's quality, its last incident (`MachineInsights`). Each tile links to the machine's
 * URL; a live machine's to the session running on it.
 */
export function MachineGallery() {
  const navigate = useNavigate();
  const { byScene, available } = useLiveSessions();
  const [customSceneId, setCustomSceneId] = useState("");
  const previewsOn = usePageAwake(PREVIEW_IDLE_MS);

  const liveCount = MACHINES.filter((m) => byScene.has(m.sceneId)).length;
  const operationalCount = MACHINES.filter(
    (m) => m.status === "operational",
  ).length;
  // Open as last seen here, on a machine whose session still runs (`MachineInsights`).
  const digests = useIncidentDigests();
  const incidentCount = MACHINES.filter(
    (m) => byScene.has(m.sceneId) && digests[m.sceneId]?.closedAt === null,
  ).length;

  return (
    <div className="min-h-dvh w-full overflow-y-auto bg-underground">
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
            {incidentCount > 0 && (
              <SummaryPill
                icon="fas fa-triangle-exclamation"
                value={incidentCount}
                label={incidentCount === 1 ? "incident open" : "incidents open"}
                tone="negative"
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
                previewsOn={previewsOn}
              />
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(viewerPath(customSceneId.trim()));
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
  tone,
}: {
  icon: string;
  value: number;
  label: string;
  highlight?: boolean;
  /** `negative`: something is wrong somewhere. */
  tone?: "negative";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border bg-ground",
        tone === "negative"
          ? "border-negative/40 text-negative"
          : highlight
            ? "border-accent/40 text-accent"
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
  previewsOn,
}: {
  machine: Machine;
  sessions: LiveSession[];
  /** Whether the 3D previews may run: off while the page is left idle. */
  previewsOn: boolean;
}) {
  const { name, description, image, status } = machine;
  const isDeprecated = status === "deprecated";

  // The busiest session is the one to join.
  const liveSession = [...sessions].sort(
    (a, b) => b.usernames.length - a.usernames.length,
  )[0];
  const liveUsers = liveSession?.usernames ?? [];

  // The scene itself, live, over the picture, which shows until it is ready (or if it cannot be).
  // Deprecated machines keep their picture. A session is started only once the tile comes near
  // the screen.
  const media = useRef<HTMLDivElement>(null);
  const seen = useSeenOnce(media);
  const hasPreview = SHOW_3D_PREVIEWS && !isDeprecated && previewsOn && seen;
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("loading");
  const previewReady = hasPreview && previewStatus === "ready";

  return (
    <Link
      to={viewerPath(machine.slug, liveSession?.sessionId)}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden text-left cursor-pointer",
        "rounded-2xl [corner-shape:squircle] border bg-ground",
        "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_10px_rgba(0,0,0,0.1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        liveSession
          ? "border-accent/40 hover:border-accent/70"
          : "border-tertiary hover:border-secondary",
        isDeprecated && "opacity-60 hover:opacity-100",
      )}
    >
      {/* Media */}
      <div ref={media} className="relative aspect-4/3 overflow-hidden bg-white">
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
            {!hasPreview && (
              <span className="text-4xs uppercase tracking-[0.25em]">
                No preview yet
              </span>
            )}
          </div>
        )}

        {hasPreview && (
          <MachinePreview
            sceneId={machine.sceneId}
            onStatus={setPreviewStatus}
            className={cn(
              "absolute inset-0 pointer-events-none transition-opacity duration-700",
              previewReady ? "opacity-100" : "opacity-0",
            )}
          />
        )}

        {hasPreview && previewStatus === "loading" && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-tertiary bg-ground/80 text-4xs text-secondary backdrop-blur-sm">
            <Icon className="fas fa-circle-notch motion-safe:animate-spin text-4xs" />
            Loading 3D
          </span>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-start gap-2 p-3">
          {status && (
            <span
              className={cn(
                "inline-flex items-center h-6 px-2 rounded-full border text-3xs font-medium backdrop-blur-sm",
                MACHINE_STATUS[status].className,
              )}
            >
              {MACHINE_STATUS[status].label}
            </span>
          )}
          {liveSession && <LiveBadge />}
        </div>
      </div>

      {/* Body */}
      <div className="flex grow flex-col gap-3 p-4">
        <div>
          <h2 className="font-orbitron text-lg font-bold text-primary">
            {name}
          </h2>
          {description && (
            <p className="mt-0.5 text-3xs text-secondary truncate">
              {description}
            </p>
          )}
        </div>

        {/* Where it stands, in a few rows: the machine, the part, its last incident. */}
        <MachineInsights machine={machine} isLive={liveSession !== undefined} />

        <div className="mt-auto flex items-center justify-between border-t border-tertiary pt-3 text-2xs">
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
    </Link>
  );
}

//------------------------------------------------------------------------------
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-2 h-6 px-2 rounded-full bg-accent text-white text-4xs font-bold tracking-wider">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      LIVE
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

//------------------------------------------------------------------------------
/** True until no one has moved, typed or scrolled on the page for `idleMs`; true again on the next. */
function usePageAwake(idleMs: number) {
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), idleMs);
    };
    const events = [
      "pointermove",
      "pointerdown",
      "keydown",
      "wheel",
      "scroll",
      "touchstart",
    ] as const;
    wake();
    for (const event of events) {
      window.addEventListener(event, wake, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const event of events) {
        window.removeEventListener(event, wake);
      }
    };
  }, [idleMs]);

  return awake;
}

/** Whether the element has come near the screen yet; it stays true once it has. */
function useSeenOnce(ref: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (seen || !element) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen]);

  return seen;
}
