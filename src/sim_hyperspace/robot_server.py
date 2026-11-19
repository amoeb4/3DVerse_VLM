#!/usr/bin/env python3
"""Serveur gRPC de pilotage d'un robot 6 axes a partir d'une trace SINUMERIK.

La trace (DAVID_POS_ROBOT_TUBE.xml) contient les consignes $/Channel/!SMA/actToolBasePos
des 6 axes, echantillonnees a 8 ms. Le fichier est compresse : un champ absent d'un
<rec> signifie "valeur inchangee", et un trou dans le temps signifie "robot immobile".

Le serveur rejoue cette trajectoire a la demande (Play / Pause / Stop / Seek / SetSpeed)
et envoie chaque consigne articulaire a un Backend. Le backend par defaut est un
simulateur ; pour piloter la machine reelle, implementer SinumerikBackend.send().

Lancement :
    pip install -r requirements.txt
    python robot_server.py --trace DAVID_POS_ROBOT_TUBE.xml
"""
import argparse
import logging
import re
import subprocess
import sys
import threading
import time
import xml.etree.ElementTree as ET
from concurrent import futures
from pathlib import Path

import grpc
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
try:
    import robot_pb2
    import robot_pb2_grpc
except ImportError:  # generation automatique des stubs au premier lancement
    subprocess.check_call([
        sys.executable, "-m", "grpc_tools.protoc", f"-I{HERE}",
        f"--python_out={HERE}", f"--grpc_python_out={HERE}", str(HERE / "robot.proto"),
    ])
    import robot_pb2
    import robot_pb2_grpc

log = logging.getLogger("robot")

N_AXES = 6
TICK_S = 0.008          # cadence de consigne = periode d'echantillonnage de la trace
IDLE_GAP_S = 0.5        # un trou > 0.5 s dans la trace = robot immobile
IDLE_MARGIN_S = 0.05    # marge gardee avant la reprise du mouvement
RS = robot_pb2.RunState


# --------------------------------------------------------------------------- trace
class Trace:
    """Trajectoire des 6 axes, reconstruite depuis le XML (maintien de valeur)."""

    def __init__(self, path: Path):
        self.path = Path(path)
        sig_axis = {}        # id du signal (f1..f6) -> index d'axe
        self.signal_names = [""] * N_AXES
        times, rows = [], []
        cur = [None] * N_AXES
        for _, el in ET.iterparse(self.path, events=("end",)):
            if el.tag == "dataSignal":
                m = re.search(r"\[u\d+,\s*(\d+)\]", el.get("name", ""))
                if m and 1 <= int(m.group(1)) <= N_AXES:
                    idx = int(m.group(1)) - 1
                    sig_axis[el.get("id")] = idx
                    self.signal_names[idx] = el.get("name")
            elif el.tag == "rec":
                for sid, idx in sig_axis.items():
                    if sid in el.attrib:
                        cur[idx] = float(el.attrib[sid])
                if any(v is None for v in cur):
                    raise ValueError("le premier enregistrement ne contient pas les 6 axes")
                times.append(float(el.get("time")))
                rows.append(tuple(cur))
                el.clear()
        if len(sig_axis) != N_AXES or not times:
            raise ValueError("trace invalide : 6 signaux d'axes attendus")
        self.times = np.asarray(times)
        self.rows = np.asarray(rows)
        self.duration = float(self.times[-1])
        gaps = np.diff(self.times)
        self.idle_s = float(gaps[gaps > IDLE_GAP_S].sum())

    def pose_at(self, t: float) -> np.ndarray:
        i = max(int(np.searchsorted(self.times, t, side="right")) - 1, 0)
        return self.rows[i]

    def skip_idle(self, t: float) -> float:
        """Si t tombe dans une pause immobile, avance jusqu'a juste avant la reprise."""
        i = int(np.searchsorted(self.times, t, side="right")) - 1
        if 0 <= i < len(self.times) - 1:
            nxt = self.times[i + 1]
            if nxt - self.times[i] > IDLE_GAP_S and nxt - t > IDLE_MARGIN_S:
                return float(nxt - IDLE_MARGIN_S)
        return t


# ------------------------------------------------------------------------- backends
class Backend:
    """Destination des consignes articulaires (degres)."""

    def send(self, axes_deg: np.ndarray) -> None:
        raise NotImplementedError


class SimBackend(Backend):
    """Simulateur : ne pilote rien, garde la derniere consigne."""

    def __init__(self):
        self.last = None

    def send(self, axes_deg: np.ndarray) -> None:
        self.last = axes_deg.copy()


class SinumerikBackend(Backend):
    """A completer pour la machine reelle (non fourni : depend de votre interface).

    Le fichier XML ne contient que des positions enregistrees, pas de variables
    d'ecriture. Il faut ici ecrire les 6 consignes dans la CN (OPC UA, variables
    NC/PLC, ou programme CN qui lit des $A_DBR) a chaque appel de send().
    Attention : Stop() fait revenir le curseur au debut ; sur le robot reel, prevoir
    un deplacement de retour a vitesse limitee plutot qu'un saut de consigne.
    """

    def send(self, axes_deg: np.ndarray) -> None:
        raise NotImplementedError("Interface Sinumerik a implementer")


# --------------------------------------------------------------------------- lecteur
class Player:
    def __init__(self, trace: Trace, backend: Backend, max_vel_deg_s: float):
        self.trace, self.backend, self.max_vel = trace, backend, max_vel_deg_s
        self.lock = threading.RLock()
        self.run_state = RS.RUN_STATE_IDLE
        self.t = 0.0
        self.speed = 1.0
        self.skip_idle = False
        self.loop = False
        self.fault = ""
        self.pose = trace.pose_at(0.0).copy()
        backend.send(self.pose)
        threading.Thread(target=self._run, daemon=True, name="player").start()

    def _run(self):
        last = time.monotonic()
        nxt = last
        while True:
            nxt += TICK_S
            delay = nxt - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            else:
                nxt = time.monotonic()
            now = time.monotonic()
            dt_wall = min(now - last, 0.1)
            last = now
            with self.lock:
                if self.run_state == RS.RUN_STATE_PLAYING:
                    self._advance(dt_wall)

    def _advance(self, dt_wall: float):
        t_new = self.t + dt_wall * self.speed
        if self.skip_idle:
            t_new = self.trace.skip_idle(t_new)
        wrapped = False
        if t_new >= self.trace.duration:
            if self.loop:
                t_new, wrapped = 0.0, True
            else:
                t_new = self.trace.duration
                self.run_state = RS.RUN_STATE_FINISHED
        new_pose = self.trace.pose_at(t_new)
        if not wrapped and dt_wall > 0:
            vel = np.abs(new_pose - self.pose) / dt_wall
            if vel.max() > self.max_vel:
                axis = int(vel.argmax()) + 1
                self.fault = (f"vitesse A{axis} = {vel.max():.1f} deg/s "
                              f"> limite {self.max_vel:.1f} deg/s")
                self.run_state = RS.RUN_STATE_FAULT
                log.error("DEFAUT : %s", self.fault)
                return  # la consigne fautive n'est pas envoyee
        try:
            self.backend.send(new_pose)
        except Exception as exc:  # noqa: BLE001
            self.fault = f"erreur backend : {exc}"
            self.run_state = RS.RUN_STATE_FAULT
            log.exception("erreur backend")
            return
        self.t, self.pose = t_new, new_pose.copy()

    # --- commandes
    def play(self, speed, skip_idle, loop, from_start):
        with self.lock:
            if self.run_state == RS.RUN_STATE_FAULT:
                raise RuntimeError("defaut actif : appeler Stop() pour acquitter")
            if speed > 0:
                self.speed = speed
            self.skip_idle, self.loop = skip_idle, loop
            if from_start or self.run_state == RS.RUN_STATE_FINISHED:
                self._set_cursor(0.0)
            self.run_state = RS.RUN_STATE_PLAYING

    def pause(self):
        with self.lock:
            if self.run_state == RS.RUN_STATE_PLAYING:
                self.run_state = RS.RUN_STATE_PAUSED

    def stop(self):
        with self.lock:
            self.fault = ""
            self._set_cursor(0.0)
            self.run_state = RS.RUN_STATE_IDLE

    def seek(self, t):
        with self.lock:
            if self.run_state == RS.RUN_STATE_PLAYING:
                raise RuntimeError("Seek impossible pendant la lecture : faire Pause() d'abord")
            if self.run_state == RS.RUN_STATE_FAULT:
                raise RuntimeError("defaut actif : appeler Stop() pour acquitter")
            self._set_cursor(min(max(t, 0.0), self.trace.duration))
            if self.run_state == RS.RUN_STATE_FINISHED:
                self.run_state = RS.RUN_STATE_PAUSED

    def set_speed(self, speed):
        with self.lock:
            self.speed = speed

    def _set_cursor(self, t):
        self.t = t
        self.pose = self.trace.pose_at(t).copy()
        self.backend.send(self.pose)

    def snapshot(self):
        with self.lock:
            return robot_pb2.RobotState(
                run_state=self.run_state, time_s=self.t, duration_s=self.trace.duration,
                speed=self.speed, axes_deg=self.pose.tolist(), fault=self.fault,
                skip_idle=self.skip_idle, loop=self.loop)


# --------------------------------------------------------------------------- service
class RobotService(robot_pb2_grpc.RobotControlServicer):
    def __init__(self, player: Player):
        self.p = player

    def _do(self, context, fn, *args):
        try:
            fn(*args)
        except RuntimeError as exc:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, str(exc))
        return self.p.snapshot()

    def GetInfo(self, request, context):
        tr = self.p.trace
        return robot_pb2.TrajectoryInfo(
            source_file=tr.path.name,
            axis_names=[f"A{i + 1}" for i in range(N_AXES)],
            signal_names=tr.signal_names,
            duration_s=tr.duration, sample_period_s=TICK_S,
            record_count=len(tr.times),
            min_deg=tr.rows.min(axis=0).tolist(), max_deg=tr.rows.max(axis=0).tolist(),
            idle_s=tr.idle_s)

    def GetState(self, request, context):
        return self.p.snapshot()

    def Play(self, request, context):
        if request.speed < 0 or request.speed > 50:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "speed doit etre dans ]0, 50]")
        return self._do(context, self.p.play, request.speed, request.skip_idle,
                        request.loop, request.from_start)

    def Pause(self, request, context):
        return self._do(context, self.p.pause)

    def Stop(self, request, context):
        return self._do(context, self.p.stop)

    def Seek(self, request, context):
        return self._do(context, self.p.seek, request.time_s)

    def SetSpeed(self, request, context):
        if not 0 < request.speed <= 50:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "speed doit etre dans ]0, 50]")
        return self._do(context, self.p.set_speed, request.speed)

    def StreamState(self, request, context):
        rate = min(max(request.rate_hz or 25.0, 0.5), 125.0)
        while context.is_active():
            state = self.p.snapshot()
            yield state
            if request.stop_when_finished and state.run_state in (
                    RS.RUN_STATE_FINISHED, RS.RUN_STATE_FAULT):
                return
            time.sleep(1.0 / rate)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--trace", default=str(HERE / "DAVID_POS_ROBOT_TUBE.xml"))
    ap.add_argument("--host", default="127.0.0.1",
                    help="adresse d'ecoute (0.0.0.0 pour ouvrir au reseau : pas d'authentification !)")
    ap.add_argument("--port", type=int, default=50051)
    ap.add_argument("--max-vel", type=float, default=30.0,
                    help="vitesse articulaire max autorisee en deg/s (defaut 30)")
    ap.add_argument("--log-level", default="INFO")
    args = ap.parse_args()
    logging.basicConfig(level=args.log_level.upper(),
                        format="%(asctime)s %(levelname)s %(message)s")

    trace = Trace(args.trace)
    log.info("trace chargee : %d enregistrements, %.0f s (dont %.0f s immobile)",
             len(trace.times), trace.duration, trace.idle_s)
    player = Player(trace, SimBackend(), args.max_vel)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    robot_pb2_grpc.add_RobotControlServicer_to_server(RobotService(player), server)
    addr = f"{args.host}:{args.port}"
    server.add_insecure_port(addr)
    server.start()
    log.info("serveur gRPC en ecoute sur %s", addr)
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        server.stop(grace=1)


if __name__ == "__main__":
    main()
