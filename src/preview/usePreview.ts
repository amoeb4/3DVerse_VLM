import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useEntity } from "@3dverse/livelink-react";
import * as THREE from "three";

import type { RobotKinematics } from "../config";
import { PartEntitiesContext } from "../partEntitiesContext";
import { holdArm } from "./armHold";
import { pointAt, type MpfProgram } from "./mpf";
import { Playback } from "./playback";
import { previewGeometry, PreviewRecord } from "./previewPart";
import {
  BUNDLED_PROGRAMS,
  loadProgram,
  programLabel,
  type ProgramSource,
} from "./programs";
import {
  RobotPreview,
  type ProgramSolution,
  type RobotPose,
} from "./robotPreview";

/** The arm's entities are sent their axes this often at most, a second. */
const APPLY_HZ = 30;

export type ProgramState =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "error"; name: string; message: string }
  | {
      status: "ready";
      /** The program played, and before it those shown laid already. */
      programs: MpfProgram[];
      program: MpfProgram;
    };

export type RobotState =
  /** The machine has no kinematics: the path only. */
  | { status: "none" }
  | { status: "unavailable"; reason: string }
  | { status: "waiting" }
  | { status: "solving"; progress: number }
  | { status: "ready"; solution: ProgramSolution; program: MpfProgram }
  | { status: "error"; message: string };

/**
 * Preview mode's state: the program picked, loaded, its part, the clock playing it back, and the
 * robot moving with it by inverse kinematics. Loads and drives the arm only while `active`; once
 * not, the arm goes back where it stood and the live feed has it again.
 */
export function usePreview({
  active,
  kinematics,
}: {
  active: boolean;
  kinematics?: RobotKinematics;
}) {
  const playback = useMemo(() => new Playback(), []);
  // Out of Preview, the program stops where it was.
  useEffect(() => {
    if (!active) playback.pause();
  }, [active, playback]);
  useEffect(() => () => playback.pause(), [playback]);

  const [source, setSource] = useState<ProgramSource | null>(
    BUNDLED_PROGRAMS[0] ?? null,
  );
  // The bundled programs before the one played, laid already: they build one part.
  const [withEarlier, setWithEarlier] = useState(true);
  const [program, setProgram] = useState<ProgramState>({ status: "idle" });

  // --- The program --------------------------------------------------------------------------
  useEffect(() => {
    if (!active || !source) return;
    let cancelled = false;
    const earlier =
      source.kind === "bundled" && withEarlier
        ? BUNDLED_PROGRAMS.slice(
            0,
            BUNDLED_PROGRAMS.findIndex((p) => p.name === source.name),
          )
        : [];
    setProgram((previous) =>
      previous.status === "ready" && previous.program.name === source.name
        ? previous
        : { status: "loading", name: source.name },
    );
    Promise.all([...earlier, source].map(loadProgram))
      .then((programs) => {
        if (cancelled) return;
        setProgram((previous) =>
          previous.status === "ready" &&
          previous.programs.length === programs.length &&
          previous.programs.every((p, i) => p === programs[i])
            ? previous
            : {
                status: "ready",
                programs,
                program: programs[programs.length - 1],
              },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProgram({
          status: "error",
          name: source.name,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [active, source, withEarlier]);

  const ready = program.status === "ready" ? program : null;
  const current = ready?.program ?? null;

  // The clock, on the program's length.
  useEffect(() => {
    playback.reset(current?.duration ?? 0);
  }, [playback, current]);

  // The part it lays, as Part mode draws one.
  const geometry = useMemo(
    () =>
      ready
        ? previewGeometry(
            ready.programs,
            ready.programs.map((p) => programLabel(p.name)).join(" + "),
          )
        : null,
    [ready],
  );
  const record = useMemo(
    () =>
      ready
        ? new PreviewRecord(ready.programs, ready.programs.length - 1)
        : null,
    [ready],
  );

  // --- The robot ----------------------------------------------------------------------------
  const { entitiesMap } = useContext(PartEntitiesContext);
  const { entity: workpiece } = useEntity(
    kinematics ? { euid: kinematics.workpiece.euid } : { name: "__none__" },
  );
  const [robot, setRobot] = useState<RobotState>(
    kinematics ? { status: "waiting" } : { status: "none" },
  );
  const [driver, setDriver] = useState<RobotPreview | null>(null);
  // When someone else last moved the arm while it played (`RobotPreview.watchExternal`).
  const [contestedAt, setContestedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!kinematics) {
      setRobot({ status: "none" });
      return;
    }
    if (!active || !current) return;
    if (entitiesMap.size === 0 || !workpiece) {
      setRobot({ status: "waiting" });
      return;
    }
    const axes = Array.from({ length: 8 }, (_, i) =>
      entitiesMap.get(`part_${i + 1}`),
    );
    // From now on, the arm is this viewer's, not the live feed's.
    const release = holdArm();
    const created = RobotPreview.create(axes, workpiece, kinematics);
    if (typeof created === "string") {
      release();
      setRobot({ status: "unavailable", reason: created });
      return;
    }
    const abort = new AbortController();
    setRobot({ status: "solving", progress: 0 });
    let stopDriving: (() => void) | null = null;

    created
      .solveProgram(
        current,
        (progress) => {
          if (!abort.signal.aborted) setRobot({ status: "solving", progress });
        },
        abort.signal,
      )
      .then((solution) => {
        if (abort.signal.aborted) return;
        setRobot({ status: "ready", solution, program: current });
        setDriver(created);
        let reportedAt = 0;
        stopDriving = drive(playback, current, solution, created, () => {
          // Said once a second at most: a live feed elsewhere sends many a second.
          const now = Date.now();
          if (now - reportedAt > 1000) {
            reportedAt = now;
            setContestedAt(now);
          }
        });
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        setRobot({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      abort.abort();
      stopDriving?.();
      setDriver(null);
      setContestedAt(null);
      created.restore();
      release();
    };
  }, [active, current, kinematics, entitiesMap, workpiece, playback]);

  /** The robot's axes at the playback's time; `null` until solved. */
  const poseNow = useCallback((): RobotPose | null => {
    if (robot.status !== "ready" || robot.program !== current || !current) {
      return null;
    }
    const { index, fraction } = pointAt(current, playback.time);
    return RobotPreview.poseAt(robot.solution, index, fraction);
  }, [robot, current, playback]);

  // --- Autoplay -----------------------------------------------------------------------------
  // The bundled programs one after the other, the earlier ones laid, from the last back to the
  // first: the whole part, built again and again.
  const [autoplay, setAutoplayState] = useState(false);
  // The program to start as soon as it can — loaded, its robot solved (or none to solve) — by name:
  // not the one still current while the next loads.
  const [startPending, setStartPending] = useState<string | null>(null);
  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayState(on);
    if (!on) {
      setStartPending(null);
      return;
    }
    setWithEarlier(true);
    setSource((previous) => {
      const next =
        previous?.kind === "bundled" ? previous : (BUNDLED_PROGRAMS[0] ?? null);
      setStartPending(next?.name ?? null);
      return next;
    });
  }, []);

  // At a program's end, the next.
  useEffect(() => {
    if (!autoplay) return;
    return playback.onEnded(() => {
      setSource((previous) => {
        const at = BUNDLED_PROGRAMS.findIndex((p) => p.name === previous?.name);
        const next =
          BUNDLED_PROGRAMS[(at + 1) % BUNDLED_PROGRAMS.length] ?? previous;
        setStartPending(next?.name ?? null);
        return next;
      });
    });
  }, [autoplay, playback]);

  // Started once that program and its robot are ready.
  const isSolvedFor =
    robot.status === "ready"
      ? robot.program === current
      : robot.status !== "solving" && robot.status !== "waiting";
  useEffect(() => {
    if (
      !startPending ||
      !autoplay ||
      !active ||
      current?.name !== startPending ||
      !isSolvedFor
    ) {
      return;
    }
    setStartPending(null);
    if (playback.time >= playback.duration) playback.seek(0);
    playback.play();
  }, [startPending, autoplay, active, current, isSolvedFor, playback]);

  // --- The arc -------------------------------------------------------------------------------
  /**
   * Where the arc burns: the program's point at the playback's time, on the part as it is drawn —
   * the part's frame on its plate (`PartInCell`'s `origin`), wherever the positioner carries it.
   * Not the torch's tip: the part is what the program describes. `null` without a frame.
   */
  const arcPosition = useCallback((): [number, number, number] | null => {
    const matrix = workpiece?.ls_to_ws as unknown as number[] | undefined;
    if (!current || !kinematics || !matrix) return null;
    const { index, fraction } = pointAt(current, playback.time);
    const next = Math.min(index + 1, current.count - 1);
    const p = current.position;
    const at = (k: number) =>
      p[index * 3 + k] + (p[next * 3 + k] - p[index * 3 + k]) * fraction;
    const world = new THREE.Matrix4().fromArray(matrix);
    const perMm =
      0.001 / new THREE.Vector3().setFromMatrixColumn(world, 0).length();
    const [ox, oy, oz] = kinematics.workpiece.origin;
    return new THREE.Vector3(
      ox + at(0) * perMm,
      oy + at(1) * perMm,
      oz + at(2) * perMm,
    )
      .applyMatrix4(world)
      .toArray() as [number, number, number];
  }, [current, kinematics, workpiece, playback]);

  /** Whether the arc burns: playing, on a move that lays metal. */
  const isArcOn = useCallback((): boolean => {
    if (!current || !playback.playing) return false;
    const { index } = pointAt(current, playback.time);
    return current.arc[Math.min(index + 1, current.count - 1)] === 1;
  }, [current, playback]);

  return {
    playback,
    source,
    setSource,
    withEarlier,
    setWithEarlier,
    program,
    geometry,
    record,
    robot,
    /** The robot playing, once solved. */
    driver,
    /** When someone else last moved the arm during the playback (`Date.now()`); `null`, never. */
    contestedAt,
    poseNow,
    hasKinematics: Boolean(kinematics),
    /** Playing the bundled programs one after the other, in a loop. */
    autoplay,
    setAutoplay,
    arcPosition,
    isArcOn,
  };
}

export type PreviewState = ReturnType<typeof usePreview>;

/**
 * The robot following the playback: its axes sent `APPLY_HZ` times a second at most. When someone
 * else moves the arm meanwhile, `onContested`, and the playback's pose is sent again at once.
 */
function drive(
  playback: Playback,
  program: MpfProgram,
  solution: ProgramSolution,
  robot: RobotPreview,
  onContested: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastApplied = 0;
  const pose: RobotPose = [];
  const apply = () => {
    timer = null;
    lastApplied = performance.now();
    const { index, fraction } = pointAt(program, playback.time);
    robot.apply(RobotPreview.poseAt(solution, index, fraction, pose));
  };
  const schedule = () => {
    if (timer) return;
    const wait = Math.max(
      0,
      1000 / APPLY_HZ - (performance.now() - lastApplied),
    );
    timer = setTimeout(apply, wait);
  };
  apply();
  const stop = playback.onFrame(schedule);
  const stopWatching = robot.watchExternal(() => {
    onContested();
    schedule();
  });
  return () => {
    stop();
    stopWatching();
    if (timer) clearTimeout(timer);
  };
}
